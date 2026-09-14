/**
 * useWebSocketStream - Ultra-low-latency screen projection & direct control via WebSocket raw H.264 stream
 *
 * Features:
 * 1. 100% TCP penetration: reliable fallback when UDP is blocked by symmetric NAT/firewalls without TURN;
 * 2. Hardware decoding: direct GPU decoding via WebCodecs VideoDecoder with seamless WASM fallback;
 * 3. Full direct control: identical API surface to useWebRTC (sendTouch, sendInjectKeycode, sendScroll, etc.);
 *    Automatically accounts for object-fit: contain letterbox/pillarbox and coordinate mapping;
 * 4. Dynamic telemetry: reports decoded FPS, bitrate, and resolution adaptively.
 */

import { ref, computed, watch, onUnmounted } from 'vue'
import { useDeviceStore } from '@/stores/devices'
import { H264Decoder } from 'h264decoder'

export function useWebSocketStream(deviceId, options = {}) {
  const deviceStore = useDeviceStore()

  // --- State variables (aligned with useWebRTC) ---
  const status = ref('disconnected') // 'disconnected' | 'connecting' | 'connected'
  const error = ref(null)
  const isWebCodecsActive = ref(typeof VideoDecoder !== 'undefined')
  const stream = ref(null) // Compatibility placeholder
  const agentVersion = ref('unknown')
  const cameraSupport = ref(false)
  const deviceRotation = ref(0)
  const isFirstFrameRendered = ref(false)

  // Video resolution & stats (physical display base dimensions)
  const currentDevice = computed(() => deviceStore.devices.find(d => d.id === deviceId))
  const displayInfo = computed(() => currentDevice.value?.info?.displays?.[0])
  const DEVICE_W = ref(displayInfo.value?.x_res || 1080)
  const DEVICE_H = ref(displayInfo.value?.y_res || 1920)

  watch(displayInfo, (info) => {
    if (info && info.x_res && info.y_res) {
      DEVICE_W.value = info.x_res
      DEVICE_H.value = info.y_res
    }
  }, { immediate: true })

  const videoNaturalSize = ref({ width: 0, height: 0 })
  const realFps = ref(0)
  const realBitrate = ref(0)
  const targetBitrateMbps = ref(
    options.bitrate
      ? (options.bitrate >= 10000 ? Math.round(options.bitrate / 100000) / 10 : options.bitrate)
      : (options.preview_bitrate ? Math.round(options.preview_bitrate / 100000) / 10 : 4)
  )

  // Canvas and DOM element getters
  let canvasGetter = null
  let frameSizeCallback = null
  let controlEventCallback = null
  let screenshotCallback = null
  let clipboardCallback = null

  // Connection timeout: wait for initial keyframe after start_preview
  const CONNECT_TIMEOUT_MS = 10000
  let connectTimeoutTimer = null
  function armConnectTimeout() {
    clearConnectTimeout()
    connectTimeoutTimer = setTimeout(() => {
      if (status.value === 'connecting') {
        error.value = 'Stream timeout: device may be offline, Agent version may be outdated, or TCP stream is blocked'
        status.value = 'disconnected'
      }
    }, CONNECT_TIMEOUT_MS)
  }
  function clearConnectTimeout() {
    if (connectTimeoutTimer) {
      clearTimeout(connectTimeoutTimer)
      connectTimeoutTimer = null
    }
  }

  // Decoder instance and buffer
  let videoDecoder = null
  let h264Decoder = null
  let hasConfigured = false
  let lastSps = null
  let lastPps = null
  let hasReceivedKeyFrame = false

  // Touch sequence and throttling
  let touchSeq = 0
  let lastMoveSentTs = 0
  let lastMoveSentX = -999
  let lastMoveSentY = -999
  const THROTTLE_INTERVAL_MS = 20
  const MOVE_DISTANCE_THRESHOLD_SQ = 9 // 3px^2

  // Statistics tracking (FPS / Bitrate)
  let frameCount = 0
  let byteCount = 0
  let lastStatsTime = performance.now()
  let statsTimer = null

  // --- Utility Helpers ---
  function areBuffersEqual(buf1, buf2) {
    if (!buf1 || !buf2) return false
    if (buf1.length !== buf2.length) return false
    for (let i = 0; i < buf1.length; i++) {
      if (buf1[i] !== buf2[i]) return false
    }
    return true
  }

  function parseAnnexB(buffer) {
    const naluList = []
    const len = buffer.length
    let i = 0
    while (i < len) {
      let startCodeLen = 0
      if (i + 2 < len && buffer[i] === 0 && buffer[i + 1] === 0 && buffer[i + 2] === 1) {
        startCodeLen = 3
      } else if (i + 3 < len && buffer[i] === 0 && buffer[i + 1] === 0 && buffer[i + 2] === 0 && buffer[i + 3] === 1) {
        startCodeLen = 4
      }

      if (startCodeLen > 0) {
        const naluStart = i + startCodeLen
        i = naluStart
        while (i < len) {
          if (i + 2 < len && buffer[i] === 0 && buffer[i + 1] === 0 && buffer[i + 2] === 1) {
            break
          }
          if (i + 3 < len && buffer[i] === 0 && buffer[i + 1] === 0 && buffer[i + 2] === 0 && buffer[i + 3] === 1) {
            break
          }
          i++
        }
        const naluEnd = i
        if (naluEnd > naluStart) {
          naluList.push(buffer.subarray(naluStart, naluEnd))
        }
      } else {
        i++
      }
    }
    return naluList
  }

  // --- Decoder Pipeline ---
  function initDecoder(preferredMode = 'webcodecs') {
    if (preferredMode === 'webcodecs' && typeof VideoDecoder !== 'undefined') {
      if (videoDecoder && videoDecoder.state !== 'closed') return

      try {
        videoDecoder = new VideoDecoder({
          output: (frame) => {
            frameCount++
            const canvasEl = canvasGetter ? canvasGetter() : null
            if (!canvasEl) {
              frame.close()
              return
            }
            const ctx = canvasEl.getContext('2d', { desynchronized: true })
            if (!ctx) {
              frame.close()
              return
            }

            const dispW = frame.displayWidth || frame.codedWidth
            const dispH = frame.displayHeight || frame.codedHeight

            if (canvasEl.width !== dispW || canvasEl.height !== dispH) {
              canvasEl.width = dispW
              canvasEl.height = dispH
              videoNaturalSize.value = { width: dispW, height: dispH }
              if (!DEVICE_W.value || !DEVICE_H.value) {
                DEVICE_W.value = dispW
                DEVICE_H.value = dispH
              }
              if (frameSizeCallback) {
                frameSizeCallback(dispW, dispH)
              }
            }

            ctx.drawImage(frame, 0, 0, canvasEl.width, canvasEl.height)
            frame.close() // Release GPU frame buffer

            if (!isFirstFrameRendered.value) {
              isFirstFrameRendered.value = true
              status.value = 'connected'
              clearConnectTimeout()
            }
          },
          error: (err) => {
            console.warn(`[useWebSocketStream] WebCodecs hardware decoder error for ${deviceId}, falling back to WASM:`, err)
            isWebCodecsActive.value = false
            try {
              videoDecoder.close()
            } catch (e) {}
            videoDecoder = null
            initDecoder('wasm')
          }
        })

        isWebCodecsActive.value = true
        hasConfigured = false
        lastSps = null
        lastPps = null
        return
      } catch (e) {
        console.warn(`[useWebSocketStream] Failed to initialize WebCodecs for ${deviceId}:`, e)
      }
    }

    // Fallback to WASM software decoder
    isWebCodecsActive.value = false
    if (!h264Decoder) {
      try {
        h264Decoder = new H264Decoder()
      } catch (err) {
        console.error(`[useWebSocketStream] Failed to initialize WASM decoder:`, err)
        error.value = 'WASM decoder initialization failed'
      }
    }
  }

  // WASM YUV rendering
  function renderYUV(canvasEl, yuv, width, height) {
    frameCount++
    const ctx = canvasEl.getContext('2d')
    if (!ctx) return

    if (canvasEl.width !== width || canvasEl.height !== height) {
      canvasEl.width = width
      canvasEl.height = height
      videoNaturalSize.value = { width, height }
      if (!DEVICE_W.value || !DEVICE_H.value) {
        DEVICE_W.value = width
        DEVICE_H.value = height
      }
      if (frameSizeCallback) {
        frameSizeCallback(width, height)
      }
    }

    const imgData = ctx.createImageData(width, height)
    const buf = new ArrayBuffer(imgData.data.length)
    const buf8 = new Uint8ClampedArray(buf)
    const buf32 = new Uint32Array(buf)

    const ySize = width * height
    const chromaSize = ySize >> 2

    let i = 0
    for (let y = 0; y < height; y++) {
      const yOffset = y * width
      const uvRow = (y >> 1) * (width >> 1)
      for (let x = 0; x < width; x++) {
        const Y = yuv[yOffset + x]
        const uvCol = x >> 1
        const U = yuv[ySize + uvRow + uvCol] - 128
        const V = yuv[ySize + chromaSize + uvRow + uvCol] - 128

        let r = Y + 1.402 * V
        let g = Y - 0.344 * U - 0.714 * V
        let b = Y + 1.772 * U

        const R = r < 0 ? 0 : (r > 255 ? 255 : r | 0)
        const G = g < 0 ? 0 : (g > 255 ? 255 : g | 0)
        const B = b < 0 ? 0 : (b > 255 ? 255 : b | 0)

        buf32[i++] = (255 << 24) | (B << 16) | (G << 8) | R
      }
    }

    imgData.data.set(buf8)
    ctx.putImageData(imgData, 0, 0)

    if (!isFirstFrameRendered.value) {
      isFirstFrameRendered.value = true
      status.value = 'connected'
      clearConnectTimeout()
    }
  }

  // Receive raw H.264 frame for decoding
  function feedFrame(nalu, isKey, ptsUs) {
    byteCount += nalu.length

    // Initial keyframe protection
    if (!hasReceivedKeyFrame) {
      if (!isKey) return
      hasReceivedKeyFrame = true
    }

    const cleanNalu = new Uint8Array(nalu.length)
    cleanNalu.set(nalu)

    if (isWebCodecsActive.value) {
      if (!videoDecoder || videoDecoder.state === 'closed') {
        initDecoder('webcodecs')
      }
      if (!videoDecoder) return

      const naluList = parseAnnexB(cleanNalu)
      let sps = null
      let pps = null
      const slices = []

      for (const n of naluList) {
        if (n.length === 0) continue
        const naluType = n[0] & 0x1F
        if (naluType === 7) {
          sps = n
        } else if (naluType === 8) {
          pps = n
        } else if (naluType === 5 || naluType === 1) {
          slices.push(n)
        }
      }

      // Generate AVCDecoderConfigurationRecord dynamically
      if (sps && pps && (!areBuffersEqual(sps, lastSps) || !areBuffersEqual(pps, lastPps))) {
        lastSps = sps
        lastPps = pps

        const record = new Uint8Array(11 + sps.length + pps.length)
        record[0] = 1 // configurationVersion
        record[1] = sps[1] // AVCProfileIndication
        record[2] = sps[2] // profile_compatibility
        record[3] = sps[3] // AVCLevelIndication
        record[4] = 0xff // lengthSizeMinusOne (4-byte length prefix)
        record[5] = 0xe1 // numOfSequenceParameterSets: 1

        record[6] = (sps.length >> 8) & 0xff
        record[7] = sps.length & 0xff
        record.set(sps, 8)

        const ppsOffset = 8 + sps.length
        record[ppsOffset] = 1 // numOfPictureParameterSets: 1
        record[ppsOffset + 1] = (pps.length >> 8) & 0xff
        record[ppsOffset + 2] = pps.length & 0xff
        record.set(pps, ppsOffset + 3)

        const codecStr = `avc1.${[sps[1], sps[2], sps[3]].map(b => b.toString(16).padStart(2, '0')).join('')}`
        try {
          videoDecoder.configure({
            codec: codecStr,
            description: record,
            optimizeForLatency: true,
            hardwareAcceleration: 'prefer-hardware'
          })
          hasConfigured = true
        } catch (err) {
          console.warn(`[useWebSocketStream] WebCodecs configure failed with ${codecStr}:`, err)
        }
      }

      if (!hasConfigured) return

      if (slices.length > 0) {
        let totalLen = 0
        for (const slice of slices) {
          totalLen += 4 + slice.length
        }

        const avccBuffer = new Uint8Array(totalLen)
        let offset = 0
        for (const slice of slices) {
          const len = slice.length
          avccBuffer[offset] = (len >> 24) & 0xff
          avccBuffer[offset + 1] = (len >> 16) & 0xff
          avccBuffer[offset + 2] = (len >> 8) & 0xff
          avccBuffer[offset + 3] = len & 0xff
          avccBuffer.set(slice, offset + 4)
          offset += 4 + len
        }

        // Backpressure guard: drop delta frames on queue buildup to avoid latency accumulation
        if (videoDecoder.decodeQueueSize > 6 && !isKey) {
          return
        }

        const chunk = new EncodedVideoChunk({
          type: isKey ? 'key' : 'delta',
          timestamp: ptsUs,
          data: avccBuffer
        })

        try {
          videoDecoder.decode(chunk)
        } catch (err) {
          console.warn(`[useWebSocketStream] WebCodecs decode failed:`, err)
        }
      }
    } else {
      // WASM mode
      if (!h264Decoder) {
        initDecoder('wasm')
      }
      if (!h264Decoder) return

      try {
        const result = h264Decoder.decode(cleanNalu)
        if (result === H264Decoder.PIC_RDY) {
          const canvasEl = canvasGetter ? canvasGetter() : null
          if (canvasEl) {
            renderYUV(canvasEl, h264Decoder.pic, h264Decoder.width, h264Decoder.height)
          }
        }
      } catch (err) {
        console.warn(`[useWebSocketStream] WASM decode failed:`, err)
      }
    }
  }

  // --- Coordinate transformation (strip object-fit: contain black bars) ---
  function computeTargetCoords(clientX, clientY, rotatedCoord = null) {
    const canvasEl = canvasGetter ? canvasGetter() : null
    if (!canvasEl) return null

    const rect = canvasEl.getBoundingClientRect()
    if (!rect.width || !rect.height) return null

    const videoW = videoNaturalSize.value.width || canvasEl.width || DEVICE_W.value || 1080
    const videoH = videoNaturalSize.value.height || canvasEl.height || DEVICE_H.value || 1920
    if (!videoW || !videoH) return null

    const isDefaultLandscape = DEVICE_W.value > DEVICE_H.value
    const isVideoLandscape = videoW > videoH
    const isRotated = isVideoLandscape !== isDefaultLandscape
    const targetW = isRotated ? DEVICE_H.value : DEVICE_W.value
    const targetH = isRotated ? DEVICE_W.value : DEVICE_H.value

    let finalX, finalY

    // Use pre-computed rotated coordinates if provided
    if (rotatedCoord && rotatedCoord.isRotated) {
      const x = Math.round(rotatedCoord.x / videoW * targetW)
      const y = Math.round(rotatedCoord.y / videoH * targetH)
      finalX = Math.max(0, Math.min(targetW, x))
      finalY = Math.max(0, Math.min(targetH, y))
    } else {
      // Normal calculation: subtract letterbox/pillarbox margins
      const clientW = rect.width
      const clientH = rect.height

      const videoRatio = videoW / videoH
      const clientRatio = clientW / clientH

      let actualW, actualH, offsetX, offsetY
      if (clientRatio > videoRatio) {
        // Pillarbox (left/right margins)
        actualH = clientH
        actualW = clientH * videoRatio
        offsetX = (clientW - actualW) / 2
        offsetY = 0
      } else {
        // Letterbox (top/bottom margins)
        actualW = clientW
        actualH = clientW / videoRatio
        offsetX = 0
        offsetY = (clientH - actualH) / 2
      }

      // Coordinate relative to actual video content
      const relativeX = clientX - rect.left - offsetX
      const relativeY = clientY - rect.top - offsetY

      // Map to device logical resolution
      const x = Math.round(relativeX / actualW * targetW)
      const y = Math.round(relativeY / actualH * targetH)

      // Boundary clamping
      finalX = Math.max(0, Math.min(targetW, x))
      finalY = Math.max(0, Math.min(targetH, y))
    }

    return {
      x: finalX,
      y: finalY,
      w: targetW,
      h: targetH
    }
  }

  // --- Touch & Input Dispatch ---
  function sendTouch(action, clientX, clientY, id = 0, rotatedCoord = null) {
    const coords = computeTargetCoords(clientX, clientY, rotatedCoord)
    if (!coords) return

    const now = Date.now()
    if (action === 2) {
      // Throttle touch MOVE events
      const dx = coords.x - lastMoveSentX
      const dy = coords.y - lastMoveSentY
      const distSq = dx * dx + dy * dy
      if (now - lastMoveSentTs < THROTTLE_INTERVAL_MS && distSq < MOVE_DISTANCE_THRESHOLD_SQ) {
        return
      }
      lastMoveSentTs = now
      lastMoveSentX = coords.x
      lastMoveSentY = coords.y
    } else if (action === 0) {
      touchSeq++
      lastMoveSentTs = 0
      lastMoveSentX = coords.x
      lastMoveSentY = coords.y
    }

    const payload = {
      type: 'touch',
      action,
      x: coords.x,
      y: coords.y,
      w: coords.w,
      h: coords.h,
      id,
      seq: touchSeq,
      client_ts_ms: now
    }

    deviceStore.sendGroupControlEvent([deviceId], payload)
    if (controlEventCallback) {
      controlEventCallback(payload)
    }
  }

  function sendInjectKeycode(action, keycode, repeat = 0, meta = 0) {
    const payload = {
      type: 'inject_keycode',
      action,
      keycode,
      repeat,
      meta
    }
    deviceStore.sendGroupControlEvent([deviceId], payload)
    if (controlEventCallback) {
      controlEventCallback(payload)
    }
  }

  function sendText(text) {
    if (!text) return
    const payload = {
      type: 'inject_text',
      text
    }
    deviceStore.sendGroupControlEvent([deviceId], payload)
  }

  function sendScroll(clientX, clientY, scrollH, scrollV, rotatedCoord = null) {
    const coords = computeTargetCoords(clientX, clientY, rotatedCoord)
    if (!coords) return false

    const payload = {
      type: 'scroll',
      action: 0,
      x: coords.x,
      y: coords.y,
      w: coords.w,
      h: coords.h,
      scrollH,
      scrollV
    }
    deviceStore.sendGroupControlEvent([deviceId], payload)
    return true
  }

  // System shortcut keys (Android Keycode: Back=4, Home=3, AppSwitch=187, Power=26, VolumeUp=24, VolumeDown=25)
  function sendBack() {
    sendInjectKeycode(0, 4)
    setTimeout(() => sendInjectKeycode(1, 4), 50)
  }

  function sendHome() {
    sendInjectKeycode(0, 3)
    setTimeout(() => sendInjectKeycode(1, 3), 50)
  }

  function sendAppSwitch() {
    sendInjectKeycode(0, 187)
    setTimeout(() => sendInjectKeycode(1, 187), 50)
  }

  function sendPower() {
    sendInjectKeycode(0, 26)
    setTimeout(() => sendInjectKeycode(1, 26), 50)
  }

  function sendVolumeUp() {
    sendInjectKeycode(0, 24)
    setTimeout(() => sendInjectKeycode(1, 24), 50)
  }

  function sendVolumeDown() {
    sendInjectKeycode(0, 25)
    setTimeout(() => sendInjectKeycode(1, 25), 50)
  }

  function sendCommand(cmd) {
    return false
  }

  function setClipboard(text, opts = {}) {
    if (text) {
      sendText(text)
      return true
    }
    return false
  }

  function getClipboard() {
    return false
  }

  // --- Metrics Timer ---
  function startStatsLoop() {
    stopStatsLoop()
    statsTimer = setInterval(() => {
      const now = performance.now()
      const deltaSec = (now - lastStatsTime) / 1000
      if (deltaSec > 0.5) {
        realFps.value = Math.round(frameCount / deltaSec)
        realBitrate.value = Math.round((byteCount * 8) / deltaSec) // bps
        frameCount = 0
        byteCount = 0
        lastStatsTime = now
      }
    }, 1000)
  }

  function stopStatsLoop() {
    if (statsTimer) {
      clearInterval(statsTimer)
      statsTimer = null
    }
  }

  async function getVideoStats() {
    const kbps = Math.round(realBitrate.value / 1000)
    return {
      fps: realFps.value,
      bitrate: kbps,
      targetBitrate: targetBitrateMbps.value,
      packetsLost: 0,
      jitterMs: 0,
      rttMs: 0
    }
  }

  function resetStats() {
    frameCount = 0
    byteCount = 0
    lastStatsTime = performance.now()
    realFps.value = 0
    realBitrate.value = 0
  }

  // --- Connection Lifecycle ---
  function connect() {
    if (status.value === 'connected' || status.value === 'connecting') return
    status.value = 'connecting'
    error.value = null
    hasReceivedKeyFrame = false
    isFirstFrameRendered.value = false

    // Desired streaming params (default 30fps / 1080p / 4Mbps)
    const fps = options.max_fps || 30
    const maxSize = options.max_size || 1080
    if (options.bitrate) {
      targetBitrateMbps.value = options.bitrate >= 10000 ? Math.round(options.bitrate / 100000) / 10 : options.bitrate
    } else if (options.preview_bitrate) {
      targetBitrateMbps.value = Math.round(options.preview_bitrate / 100000) / 10
    }
    const bitrate = targetBitrateMbps.value || 4
    const stayAwake = options.stay_awake !== false

    // Initialize decoder
    initDecoder('webcodecs')

    // Register stream callback (subscriberId: 'stream')
    deviceStore.registerPreviewCallback(deviceId, 'stream', (nalu, isKey, ptsUs) => {
      feedFrame(nalu, isKey, ptsUs)
    })

    // Send start_preview signaling
    deviceStore.sendPreviewControl('start_preview', deviceId, fps, maxSize, bitrate, stayAwake)

    startStatsLoop()
    armConnectTimeout()
  }

  function disconnect() {
    status.value = 'disconnected'
    stopStatsLoop()
    clearConnectTimeout()

    // Unregister stream callback; send stop_preview only when no other subscribers exist
    deviceStore.unregisterPreviewCallback(deviceId, 'stream')
    if (!deviceStore.hasPreviewSubscribers(deviceId)) {
      deviceStore.sendPreviewControl('stop_preview', deviceId)
    }

    // Release WebCodecs resources
    if (videoDecoder) {
      try {
        videoDecoder.close()
      } catch (e) {}
      videoDecoder = null
    }
    hasConfigured = false
    lastSps = null
    lastPps = null

    // Release WASM resources
    if (h264Decoder) {
      h264Decoder = null
    }

    isFirstFrameRendered.value = false
    hasReceivedKeyFrame = false
  }

  // --- Callback Setters ---
  function setCanvasGetter(fn) {
    canvasGetter = fn
  }

  function setVideoGetter(fn) {
    // Compatibility placeholder
  }

  function onFrameSize(cb) {
    frameSizeCallback = cb
  }

  function onControlEvent(cb) {
    controlEventCallback = cb
  }

  function onScreenshot(cb) {
    screenshotCallback = cb
  }

  function onClipboard(cb) {
    clipboardCallback = cb
  }

  const audioMuted = ref(true)
  function setAudioMuted(val) {
    audioMuted.value = Boolean(val)
  }

  function toggleAudioMuted() {
    audioMuted.value = !audioMuted.value
    return audioMuted.value
  }

  onUnmounted(() => {
    disconnect()
  })

  return {
    // State
    isWebSocketStream: true,
    status,
    error,
    isWebCodecsActive,
    stream,
    agentVersion,
    cameraSupport,
    deviceRotation,
    DEVICE_W,
    DEVICE_H,
    videoNaturalSize,
    isFirstFrameRendered,
    fps: realFps,
    bitrate: realBitrate,
    targetBitrate: targetBitrateMbps,

    // Methods
    connect,
    disconnect,
    setCanvasGetter,
    setVideoGetter,
    onFrameSize,
    onControlEvent,
    onScreenshot,
    onClipboard,
    audioMuted,
    setAudioMuted,
    toggleAudioMuted,
    getVideoStats,
    resetStats,

    // Interactions and Keycodes
    sendTouch,
    sendInjectKeycode,
    sendText,
    sendScroll,
    sendCommand,
    setClipboard,
    getClipboard,
    sendBack,
    sendHome,
    sendAppSwitch,
    sendPower,
    sendVolumeUp,
    sendVolumeDown
  }
}
