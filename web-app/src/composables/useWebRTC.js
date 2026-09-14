import { ref, onUnmounted } from 'vue'
import { useDeviceStore } from '@/stores/devices'
import { debugInfo, debugLog, debugWarn } from '@/utils/debug'
import { WebCodecsRenderer } from '@/utils/webcodecsRenderer'

export function useWebRTC(deviceId, options = {}) {
  const status = ref('disconnected')
  const error = ref(null)
  const audioMuted = ref(false)
  const cameraSupport = ref(true)
  const agentVersion = ref('unknown')
  const isWebCodecsActive = ref(false)

  // View-only share mode: block all input injections (touch/scroll/keyboard/text/clipboard).
  // Note: inputs traverse P2P datachannel, so filtering is performed at client origin.
  const viewOnly = options.view_only === true

  let webrtcObj = null
  let ws = null
  let pc = null
  let iceServers = [{ urls: 'stun:stun.l.google.com:19302' }]
  let inputChannel = null
  let clipboardChannel = null
  let videoElementGetter = null  // Function to get video element
  let canvasElementGetter = null // Function to get canvas element (WebCodecs phase-locked render)
  let webcodecsRenderer = null
  let videoStream = null
  let audioStream = null
  let audioElement = null
  let audioContext = null
  let audioSourceNode = null
  let audioGainNode = null
  let audioUnlockHandler = null
  let touchSeq = 0
  const DEVICE_W = ref(1080)
  const DEVICE_H = ref(1920)
  let controlEventCallback = null

  let cameraChannel = null

  const localCandidates = []
  const remoteCandidates = []
  let cameraStream = null
  let cameraIntervalId = null

  let aiCommandChannel = null
  const aiCommandPromises = new Map()

  function getOption(key, def) {
    try {
      const devStored = localStorage.getItem(`cloudphone_settings_${deviceId}`)
      if (devStored) {
        const val = JSON.parse(devStored)[key]
        if (val !== undefined) return val
      }
      const globalStored = localStorage.getItem('cloudphone_settings')
      if (globalStored) {
        const val = JSON.parse(globalStored)[key]
        if (val !== undefined) return val
      }
    } catch (e) {}
    return def
  }

  function connect(shareTokenParam = null, sharePwdParam = '') {
    status.value = 'connecting'
    error.value = null

    if (import.meta.env.VITE_DEMO_MODE === 'true') {
      setTimeout(() => {
        status.value = 'connected'
      }, 300)
      return
    }

    const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const token = localStorage.getItem('auth_token') || ''
    let wsUrl = `${wsProtocol}//${location.host}/connect_client?token=${encodeURIComponent(token)}`
    if (shareTokenParam) {
      wsUrl = `${wsProtocol}//${location.host}/connect_client?share_token=${encodeURIComponent(shareTokenParam)}`
      if (sharePwdParam) {
        wsUrl += `&share_pwd=${encodeURIComponent(sharePwdParam)}`
      }
    }
    
    debugLog('[Signaling] Connecting to:', wsUrl)
    ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      debugLog('[Signaling] WebSocket connected')
      status.value = 'signaling'
      ws.send(JSON.stringify({
        message_type: 'connect',
        device_id: deviceId
      }))
    }

    ws.onmessage = (evt) => {
      if (typeof evt.data !== 'string') return
      try {
        const msg = JSON.parse(evt.data)
        debugLog('[Signaling] Received:', msg.message_type || msg.type, msg)
        handleMessage(msg)
      } catch (e) {
        console.error('[Signaling] Failed to parse message:', e, evt.data)
      }
    }

    ws.onerror = (e) => {
      error.value = 'WebSocket error'
      status.value = 'error'
      console.error('WebSocket error:', e)
    }

    ws.onclose = () => {
      debugLog('[Signaling] WebSocket closed')
      if (status.value !== 'disconnected') {
        status.value = 'disconnected'
      }
    }
  }

  function handleMessage(msg) {
    const type = msg.message_type || msg.type
    switch (type) {
      case 'config':
        status.value = 'waiting_offer'
        if (msg.ice_servers && msg.ice_servers.length > 0) {
          iceServers = msg.ice_servers
          debugLog('[WebRTC] ICE Servers updated from config:', iceServers)
        }
        // Send request-offer with IP protocol preference to notify Agent network stack
        const offerPayload = { 
          type: 'request-offer',
          ip_preference: getOption('ipPreference', 'auto')
        }
        if (Object.keys(options).length > 0) {
          offerPayload.scrcpy_options = options
        }
        sendForward(offerPayload)
        break
      case 'device_info':
        handleDeviceInfo(msg.device_info)
        break
      case 'device_msg':
        handleDeviceMessage(msg.payload)
        break
      case 'screenshot_response':
        handleScreenshot(msg.data)
        break
      case 'error':
        error.value = msg.error || 'Server error'
        status.value = 'error'
        break
    }
  }

  function handleDeviceInfo(info) {
    if (info) {
      if (info.app_version) {
        agentVersion.value = info.app_version
      }
      if (info.displays && info.displays.length > 0) {
        const display = info.displays[0]
        DEVICE_W.value = display.x_res || 1080
        DEVICE_H.value = display.y_res || 1920
        debugLog(`[WebRTC] Device dimensions updated: ${DEVICE_W.value}x${DEVICE_H.value}`)
      }
    }
  }
function handleDeviceMessage(payload) {
  if (!payload || !payload.type) return

  switch (payload.type) {
    case 'offer':
      debugLog('[WebRTC] Received offer, length:', payload.sdp.length)
      cameraSupport.value = payload.camera_support !== false
      if (!cameraSupport.value) {
        debugWarn('[WebRTC] Device does not support camera injection (Camera HAL not found)')
      }
      createPeerConnection()
      const filteredOfferSdp = filterSDPCandidates(payload.sdp)
      pc.setRemoteDescription(new RTCSessionDescription({
        type: 'offer',
        sdp: filteredOfferSdp
      }))
        .then(() => pc.createAnswer())
        .then(answer => {
          // Enable SDP Munging with correct units (bps)
          let sdp = answer.sdp;
          // 1. Set bandwidth AS (kbps) to 20000 = 20Mbps
          sdp = sdp.replace(/m=video (.*)\r\n/g, `m=video $1\r\nb=AS:20000\r\n`);
          // 2. Set Google-specific parameters for common H.264 profiles (bps) 20000000 = 20Mbps
          sdp = sdp.replace(/a=fmtp:(102|96) (.*)\r\n/g, `a=fmtp:$1 $2;x-google-start-bitrate=20000000;x-google-max-bitrate=20000000\r\n`);

          const newAnswer = new RTCSessionDescription({
            type: 'answer',
            sdp: sdp
          });
          debugLog('[WebRTC] Answer SDP munged to 20Mbps (bps)')
          return pc.setLocalDescription(newAnswer);
        })
        .then(() => {
          // Send Answer immediately to initiate Trickle ICE instead of awaiting full ICE gathering.
          // Subsequent ICE candidates gathered by browser are transmitted via pc.onicecandidate.
          sendAnswer()
          status.value = 'connecting_webrtc'
        })
        .catch(e => {
          error.value = 'SDP error: ' + e.message
          console.error('SDP error:', e)
        })
      break

    case 'ice-candidate':
      if (pc && payload.candidate) {
        const candStr = payload.candidate.candidate
        remoteCandidates.push(candStr)
        if (shouldKeepCandidate(candStr)) {
          debugLog('[WebRTC] Received remote ICE candidate (accepted):', candStr)
          pc.addIceCandidate(new RTCIceCandidate(payload.candidate))
            .catch(e => console.warn('ICE error:', e))
        } else {
          debugLog('[WebRTC] Received remote ICE candidate (filtered out):', candStr)
        }
      }
      break

    case 'command_result':
      handleCommandResult(payload)
      break

    case 'scrcpy_error':
      console.error('[WebRTC] scrcpy-server error:', payload.message)
      // Clear cached camera preferences if camera ID failure causes crash
      if (payload.message && payload.message.includes('Camera with id')) {
        try {
          localStorage.removeItem(`cloudphone_camera_pref_${deviceId}`)
        } catch (e) {}
      }
      error.value = payload.message || 'scrcpy-server failed to start'
      status.value = 'error'
      if (pc) {
        pc.close()
        pc = null
      }
      break
    }
  }

  function sendInjectData(channel, payload, targetDeviceIds = null) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const msg = {
        message_type: 'inject_data',
        device_id: deviceId,
        channel: channel,
        payload: payload
      }
      if (Array.isArray(targetDeviceIds) && targetDeviceIds.length > 0) {
        msg.target_device_ids = targetDeviceIds
      }
      ws.send(JSON.stringify(msg))
    }
  }

  const commandPromises = new Map()

  function sendCommand(command) {
    const requestId = Math.random().toString(36).substring(7)
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        message_type: 'command',
        device_id: deviceId,
        request_id: requestId,
        command: command
      }))
    }
    return requestId
  }

  function executeCommand(command, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const requestId = sendCommand(command)
      const timer = setTimeout(() => {
        if (commandPromises.has(requestId)) {
          commandPromises.delete(requestId)
          reject(new Error(`Command execution timeout (${timeoutMs}ms)`))
        }
      }, timeoutMs)
      commandPromises.set(requestId, { resolve, reject, timer })
    })
  }

  function createAiCommandChannel() {
    if (!pc || pc.readyState === 'closed') {
      debugWarn('[AI-Command] Cannot create command channel, WebRTC not ready')
      return
    }
    if (aiCommandChannel && (aiCommandChannel.readyState === 'open' || aiCommandChannel.readyState === 'connecting')) {
      return
    }

    debugLog('[AI-Command] Creating P2P command DataChannel...')
    aiCommandChannel = pc.createDataChannel('ai-command-channel', { ordered: true })
    aiCommandChannel.binaryType = 'arraybuffer'

    aiCommandChannel.onopen = () => {
      debugLog('[AI-Command] P2P command DataChannel OPEN')
    }

    aiCommandChannel.onclose = () => {
      debugLog('[AI-Command] P2P command DataChannel CLOSED')
    }

    aiCommandChannel.onerror = (e) => {
      console.warn('[AI-Command] P2P command DataChannel error:', e)
    }

    aiCommandChannel.onmessage = (evt) => {
      try {
        let dataStr = evt.data
        if (evt.data instanceof ArrayBuffer) {
          dataStr = new TextDecoder().decode(evt.data)
        }
        const res = JSON.parse(dataStr)
        const reqId = res.request_id
        if (reqId && aiCommandPromises.has(reqId)) {
          const { resolve, timer } = aiCommandPromises.get(reqId)
          clearTimeout(timer)
          aiCommandPromises.delete(reqId)
          resolve(res)
        }
      } catch (e) {
        console.error('[AI-Command] Failed to parse P2P cmd result:', e)
      }
    }
  }

  function executeCommandP2P(command, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      if (!aiCommandChannel || aiCommandChannel.readyState !== 'open') {
        debugWarn('[AI-Command] P2P command channel not open, falling back to signaling channel')
        createAiCommandChannel()
        resolve(executeCommand(command, timeoutMs))
        return
      }

      const requestId = Math.random().toString(36).substring(7)
      const timer = setTimeout(() => {
        if (aiCommandPromises.has(requestId)) {
          aiCommandPromises.delete(requestId)
          reject(new Error(`P2P command execution timeout (${timeoutMs}ms)`))
        }
      }, timeoutMs)

      aiCommandPromises.set(requestId, { resolve, reject, timer })
      try {
        aiCommandChannel.send(JSON.stringify({
          request_id: requestId,
          command: command
        }))
      } catch (e) {
        clearTimeout(timer)
        aiCommandPromises.delete(requestId)
        console.warn('[AI-Command] Failed to send via P2P channel, falling back', e)
        resolve(executeCommand(command, timeoutMs))
      }
    })
  }

  let commandCallback = null
  function onCommandResult(callback) {
    commandCallback = callback
  }

  function handleCommandResult(result) {
    const reqId = result.request_id
    if (reqId && commandPromises.has(reqId)) {
      const { resolve, timer } = commandPromises.get(reqId)
      clearTimeout(timer)
      commandPromises.delete(reqId)
      resolve(result)
    }
    if (commandCallback) {
      commandCallback(result)
    }
  }

  function filterSDPCandidates(sdp) {
    if (!sdp) return sdp
    const lines = sdp.split('\r\n')
    const filteredLines = lines.filter(line => {
      if (line.startsWith('a=candidate:')) {
        return shouldKeepCandidate(line)
      }
      return true
    })
    return filteredLines.join('\r\n')
  }

  function sendAnswer() {
    if (!pc || !pc.localDescription) return
    debugLog('[WebRTC] Sending answer')
    const filteredSdp = filterSDPCandidates(pc.localDescription.sdp)
    sendForward({
      type: 'answer',
      sdp: filteredSdp
    })
  }

  function getAudioGain() {
    const value = Number(options.audio_gain ?? options.audioGain ?? 1)
    if (!Number.isFinite(value)) return 1
    return Math.max(0, Math.min(5, value))
  }

  function getAudioLowLatency() {
    return Boolean(options.audio_low_latency ?? options.audioLowLatency)
  }

  function clearAudioUnlockHandler() {
    if (audioUnlockHandler) {
      window.removeEventListener('pointerdown', audioUnlockHandler, { capture: true })
      window.removeEventListener('keydown', audioUnlockHandler, { capture: true })
      window.removeEventListener('touchstart', audioUnlockHandler, { capture: true })
      window.removeEventListener('click', audioUnlockHandler, { capture: true })
      audioUnlockHandler = null
    }
  }

  function cleanupAudioPlayback() {
    clearAudioUnlockHandler()
    if (audioSourceNode) {
      audioSourceNode.disconnect()
      audioSourceNode = null
    }
    if (audioGainNode) {
      audioGainNode.disconnect()
      audioGainNode = null
    }
    if (audioContext) {
      audioContext.close().catch(() => {})
      audioContext = null
    }
    if (audioElement) {
      audioElement.pause()
      audioElement.srcObject = null
      audioElement.remove()
      audioElement = null
    }
    audioStream = null
  }

  function playAudioElement(gain) {
    if (!audioStream) return

    clearAudioUnlockHandler()

    if (audioElement) {
      audioElement.pause()
      audioElement.srcObject = null
      audioElement.remove()
      audioElement = null
    }

    audioElement = new Audio()
    audioElement.autoplay = true
    audioElement.playsInline = true
    audioElement.muted = audioMuted.value
    audioElement.volume = Math.min(1, gain)
    audioElement.srcObject = audioStream
    audioElement.style.display = 'none'
    document.body.appendChild(audioElement)

    const play = () => {
      if (!audioElement) return
      audioElement.play()
        .then(() => {
          debugLog('[WebRTC] Audio element playing, volume:', audioElement.volume)
          clearAudioUnlockHandler()
        })
        .catch(err => {
          debugWarn('[WebRTC] audio play() blocked, waiting for user gesture:', err)
          if (!audioUnlockHandler) {
            audioUnlockHandler = () => play()
            window.addEventListener('pointerdown', audioUnlockHandler, { once: true, capture: true })
            window.addEventListener('keydown', audioUnlockHandler, { once: true, capture: true })
            window.addEventListener('touchstart', audioUnlockHandler, { once: true, capture: true })
            window.addEventListener('click', audioUnlockHandler, { once: true, capture: true })
          }
        })
    }

    audioElement.addEventListener('canplay', play, { once: true })
    audioElement.addEventListener('playing', () => {
      debugLog('[WebRTC] audio element state=playing')
    })
    audioElement.addEventListener('error', () => {
      console.warn('[WebRTC] audio element error:', audioElement?.error)
    })
    play()
  }

  function playAudioTrack(track) {
    if (options.audio === false) return

    cleanupAudioPlayback()
    audioStream = new MediaStream([track])
    const gain = getAudioGain()

    if (getAudioLowLatency()) {
      debugWarn('[WebRTC] Low latency audio experiment is disabled for now; using audio element playback')
    }
    playAudioElement(gain)

    if (track.addEventListener) {
      track.addEventListener('ended', cleanupAudioPlayback, { once: true })
    }
  }

  function shouldKeepCandidate(candidateStr) {
    if (!candidateStr) return false

    // 1. Direct vs Relay filter
    const isRelay = candidateStr.indexOf('typ relay') !== -1
    const pathPref = getOption('connectionPath', 'auto')
    if (pathPref === 'relay' && !isRelay) {
      return false // Relay-only mode, discard non-relay candidate
    }
    if (pathPref === 'direct' && isRelay) {
      return false // Direct-only mode, discard relay candidate
    }

    // 2. Robust IPv4 and IPv6 candidate filter
    let isIPv6 = false
    let isIPv4 = false
    const parts = candidateStr.trim().split(/\s+/)
    for (const part of parts) {
      if (part.startsWith('candidate:') || part.startsWith('a=candidate:')) {
        continue
      }
      if (part.split(':').length >= 3) {
        isIPv6 = true
        break
      }
      if (part.split('.').length === 4) {
        isIPv4 = true
        break
      }
    }

    const ipPref = getOption('ipPreference', 'auto')
    if (ipPref === 'ipv4' && isIPv6) {
      return false // Force IPv4, discard IPv6 candidate
    }
    if (ipPref === 'ipv6' && isIPv4) {
      return false // Force IPv6, discard IPv4 candidate
    }
    return true
  }

  function createPeerConnection() {
    if (pc) return

    localCandidates.length = 0
    remoteCandidates.length = 0

    const iceTransportPolicy = getOption('connectionPath', 'auto') === 'relay' ? 'relay' : 'all'
    const renderEnginePref = getOption('renderEngine', WebCodecsRenderer.isSupported() ? 'webcodecs' : 'video')
    const enableInsertable = (renderEnginePref === 'webcodecs' && WebCodecsRenderer.isSupported())
    debugLog('[WebRTC] Creating RTCPeerConnection with servers:', iceServers, 'policy:', iceTransportPolicy, 'insertableStreams:', enableInsertable)
    pc = new RTCPeerConnection({
      iceServers: iceServers,
      iceTransportPolicy: iceTransportPolicy,
      encodedInsertableStreams: enableInsertable
    })

    // Create File channel (actively created)
    fileChannel = pc.createDataChannel('file-channel', { ordered: true })
    fileChannel.binaryType = 'arraybuffer'
    setupFileChannel(fileChannel)

    videoStream = new MediaStream()

    pc.ontrack = (evt) => {
      debugLog('[WebRTC] ontrack event:', evt.track.kind, evt.streams)
      if (evt.receiver) {
        if ('jitterBufferTarget' in evt.receiver) {
          evt.receiver.jitterBufferTarget = 0
        }
        if ('playoutDelayHint' in evt.receiver) {
          evt.receiver.playoutDelayHint = 0
        }
      }
      if (evt.track.kind === 'audio') {
        // When encodedInsertableStreams is active (e.g. WebCodecs mode),
        // the browser also places audio receiver into Insertable Streams pipeline.
        // Encoded Opus packets must be piped to writable to prevent queue accumulation
        // which would starve the native audio decoder resulting in video without sound.
        if (enableInsertable && evt.receiver && evt.receiver.createEncodedStreams) {
          try {
            const { readable, writable } = evt.receiver.createEncodedStreams()
            readable.pipeTo(writable).catch(e => console.warn('[WebRTC] Audio insertable streams pipeTo error:', e))
          } catch (e) {
            console.warn('[WebRTC] Audio createEncodedStreams error:', e)
          }
        }

        if (options.audio === false) return
        playAudioTrack(evt.track)
        return
      }

      // Data-only connection (e.g. File Manager): bypass video to eliminate decoding overhead
      if (options.video === false) {
        debugLog('[WebRTC] video track ignored (options.video === false)')
        return
      }

      const canvas = canvasElementGetter ? canvasElementGetter() : null

      // Attempt WebCodecs + Canvas phase-locked pipeline when webcodecs mode is chosen
      if (renderEnginePref === 'webcodecs' && canvas && WebCodecsRenderer.isSupported() && evt.receiver && evt.receiver.createEncodedStreams) {
        debugLog('[WebRTC] ⚡ Activating WebCodecs Phase-Locked Hardware Renderer')
        if (webcodecsRenderer) {
          webcodecsRenderer.stop()
        }
        webcodecsRenderer = new WebCodecsRenderer(canvas, {
          onFrameSizeChange: (w, h) => {
            if (!DEVICE_W.value || !DEVICE_H.value) {
              DEVICE_W.value = w
              DEVICE_H.value = h
            }
            if (frameSizeCallback) {
              frameSizeCallback(w, h)
            }
          }
        })
        const started = webcodecsRenderer.start(evt.receiver)
        if (started) {
          isWebCodecsActive.value = true
          return
        }
      }

      // Fallback to conventional HTML5 <video> renderer
      isWebCodecsActive.value = false
      if (enableInsertable && evt.receiver && evt.receiver.createEncodedStreams) {
        try {
          const { readable, writable } = evt.receiver.createEncodedStreams()
          readable.pipeTo(writable).catch(e => console.warn('[WebRTC] pipeTo error:', e))
        } catch (e) {
          console.warn('[WebRTC] createEncodedStreams pipeTo fallback error:', e)
        }
      }

      const video = videoElementGetter ? videoElementGetter() : null
      if (video) {
        if (!videoStream) videoStream = new MediaStream()
        const exists = videoStream.getTracks().some(track => track.id === evt.track.id)
        if (!exists) {
          videoStream.addTrack(evt.track)
        }
        if (video.srcObject !== videoStream) {
          video.srcObject = videoStream
          debugLog('[WebRTC] Set srcObject to video element')
        }
        // Force playback with auto-retry if interrupted by browser autoplay or track addition
        const playPromise = video.play()
        if (playPromise !== undefined) {
          playPromise.catch(e => {
            console.warn('[WebRTC] play() initial request interrupted, auto-retrying on ready:', e)
            const tryPlayAgain = () => {
              if (video && video.paused) {
                video.play().catch(() => {})
              }
            }
            video.addEventListener('loadeddata', tryPlayAgain, { once: true })
            video.addEventListener('canplay', tryPlayAgain, { once: true })
            setTimeout(tryPlayAgain, 250)
            setTimeout(tryPlayAgain, 800)
          })
        }
      } else {
        console.error('[WebRTC] videoElement is null!')
      }
    }

    pc.onicecandidate = (evt) => {
      if (evt.candidate) {
        const candStr = evt.candidate.candidate
        localCandidates.push(candStr)
        if (shouldKeepCandidate(candStr)) {
          debugLog('[WebRTC] Sending local ICE candidate (accepted):', candStr)
          sendForward({
            type: 'ice-candidate',
            candidate: {
              candidate: evt.candidate.candidate,
              sdpMid: evt.candidate.sdpMid,
              sdpMLineIndex: evt.candidate.sdpMLineIndex
            }
          })
        } else {
          debugLog('[WebRTC] Sending local ICE candidate (filtered out):', candStr)
        }
      }
    }

    function diagnoseConnectionFailure() {
      let advice = 'WebRTC handshake failed. Recommendations: 1. Check if device and browser are on the same local network; 2. For remote access across NATs, verify that a valid TURN relay server is configured and active.'
      
      const hasOnlyDockerOrLoopback = remoteCandidates.length > 0 && remoteCandidates.every(cand => {
        const parts = cand.split(' ')
        if (parts.length >= 5) {
          const ip = parts[4]
          return ip === '127.0.0.1' || ip.startsWith('172.17.') || ip.startsWith('172.18.') || ip.startsWith('172.16.') || ip.startsWith('172.19.') || ip.startsWith('172.20.') || ip.startsWith('172.30.')
        }
        return false
      })

      const clientHasPhysicalLanIp = localCandidates.some(cand => {
        const parts = cand.split(' ')
        if (parts.length >= 5) {
          const ip = parts[4]
          return ip.startsWith('192.168.') || ip.startsWith('10.')
        }
        return false
      })

      if (hasOnlyDockerOrLoopback && clientHasPhysicalLanIp) {
        advice = 'Network physical isolation. The device reported an internal private Docker IP (e.g. 172.17.x.x) which cannot be routed directly from your LAN. Please ensure the Agent is launched with host IP mapping (via -external-addr or CP_AGENT_EXTERNAL_ADDR).'
        return advice
      }

      const hasClashTun = localCandidates.some(cand => {
        const parts = cand.split(' ')
        if (parts.length >= 5) {
          const ip = parts[4]
          return ip.startsWith('198.18.')
        }
        return false
      })

      if (hasClashTun) {
        advice = 'Network connection blocked. A VPN/Proxy TUN interface (e.g. 198.18.x.x) was detected on your computer, which can intercept WebRTC UDP handshake packets. Please disable TUN mode temporarily and reconnect.'
        return advice
      }

      return advice
    }

    pc.oniceconnectionstatechange = () => {
      debugLog('[WebRTC] ICE Connection State:', pc.iceConnectionState)
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        status.value = 'connected'
      } else if (pc.iceConnectionState === 'failed') {
        error.value = 'Connection failed: ' + diagnoseConnectionFailure()
        status.value = 'error'
      }
    }

    pc.onconnectionstatechange = () => {
      debugLog('[WebRTC] Connection State:', pc.connectionState)
      if (pc.connectionState === 'connected') {
        status.value = 'connected'
      } else if (pc.connectionState === 'failed') {
        error.value = 'Connection failed: ' + diagnoseConnectionFailure()
        status.value = 'error'
      } else if (pc.connectionState === 'closed' || pc.connectionState === 'disconnected') {
        status.value = 'disconnected'
      }
    }

    pc.ondatachannel = (evt) => {
      debugLog('[WebRTC] Received DataChannel:', evt.channel.label)
      if (evt.channel.label === 'input-channel') {
        inputChannel = evt.channel
        inputChannel.onopen = () => {
          debugLog('[DataChannel] input-channel OPEN')
        }
        inputChannel.onclose = () => {
          debugLog('[DataChannel] input-channel CLOSED')
        }
        inputChannel.onerror = (e) => console.error('[DataChannel] Error:', e)
      } else if (evt.channel.label === 'clipboard-channel') {
        clipboardChannel = evt.channel
        clipboardChannel.onopen = () => {
          debugLog('[DataChannel] clipboard-channel OPEN')
        }
        clipboardChannel.onmessage = (evt) => {
          try {
            let dataStr = evt.data
            if (evt.data instanceof ArrayBuffer) {
              dataStr = new TextDecoder().decode(evt.data)
            }
            const msg = JSON.parse(dataStr)
            if (msg.type === 'clipboard' && clipboardCallback) {
              clipboardCallback({
                text: msg.text,
                source: msg.source || 'device',
                originClientId: msg.origin_client_id ?? null
              })
            }
          } catch (e) {
            console.error('[DataChannel] Failed to parse clipboard msg:', e)
          }
        }
        clipboardChannel.onclose = () => {
          debugLog('[DataChannel] clipboard-channel CLOSED')
        }
      } else if (evt.channel.label === 'camera-channel') {
        cameraChannel = evt.channel
        cameraChannel.onopen = () => {
          debugLog('[DataChannel] camera-channel OPEN')
        }
        cameraChannel.onmessage = (evt) => {
          try {
            let dataStr = evt.data
            if (evt.data instanceof ArrayBuffer) {
              dataStr = new TextDecoder().decode(evt.data)
            }
            const msg = JSON.parse(dataStr)
            if (msg.action === 'start') {
              debugLog('[Camera] Received start command from Agent')
              startCameraStreaming()
            } else if (msg.action === 'stop') {
              debugLog('[Camera] Received stop command from Agent')
              stopCameraStreaming()
            }
          } catch (e) {
            // Ignore non-control message parse errors
          }
        }
        cameraChannel.onclose = () => {
          debugLog('[DataChannel] camera-channel CLOSED')
          stopCameraStreaming()
        }
        cameraChannel.onerror = (e) => console.error('[DataChannel] camera-channel Error:', e)
      }
    }
  }

  // --- Telemetry & Stats Logic ---
  let prevStats = { timestamp: 0, bytesReceived: 0, framesDecoded: 0 }
  let pauseCount = 0
  let wasPaused = false

  async function getVideoStats() {
    if (!pc) return null
    try {
      const stats = await pc.getStats()
      let currentRtt = 0
      let activePair = null
      
      // First pass to find RTT and active candidate pair
      for (const report of stats.values()) {
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          activePair = report
          currentRtt = (report.currentRoundTripTime || 0) * 1000
          break
        }
      }

      if (!activePair) {
        for (const report of stats.values()) {
          if (report.type === 'candidate-pair' && (report.nominated || report.selected)) {
            activePair = report
            if (report.currentRoundTripTime !== undefined) {
              currentRtt = report.currentRoundTripTime * 1000
            }
            break
          }
        }
      }

      let connectionType = 'UDP p2p'
      if (activePair) {
        const localCand = stats.get(activePair.localCandidateId)
        if (localCand) {
          const proto = (localCand.protocol || 'udp').toUpperCase()
          const candType = localCand.candidateType // 'host', 'srflx', 'prflx', 'relay'
          if (candType === 'relay') {
            connectionType = `${proto} relay`
          } else {
            connectionType = `${proto} p2p`
          }
        }
      }

      for (const report of stats.values()) {
        if (report.type === 'inbound-rtp' && report.kind === 'video') {
          const now = report.timestamp
          const dt = prevStats.timestamp ? (now - prevStats.timestamp) / 1000 : 0

          let fps = 0
          let framesDecodedVal = report.framesDecoded || 0
          let decodeTimeNum = 0
          let jbDelayNum = 0

          if (isWebCodecsActive.value && webcodecsRenderer) {
            fps = webcodecsRenderer.currentFps.toFixed(0)
            framesDecodedVal = webcodecsRenderer.totalFramesDecoded
            decodeTimeNum = 0.5 // WebCodecs GPU hardware decode duration < 0.5ms
            jbDelayNum = 0     // Direct phase-locked pipeline bypasses JitterBuffer
          } else {
            const newFrames = framesDecodedVal - prevStats.framesDecoded
            fps = dt > 0 ? (newFrames / dt).toFixed(0) : 0
            jbDelayNum = (report.jitterBufferDelay / (report.jitterBufferEmittedCount || 1) * 1000) || 0
            decodeTimeNum = (report.totalDecodeTime / (framesDecodedVal || 1) * 1000) || 0

            if (dt > 0 && newFrames === 0 && !wasPaused && status.value === 'connected') {
              pauseCount++
              wasPaused = true
              debugWarn('[VideoTrace] decode-pause', {
                pauseCount,
                ts: Date.now(),
                dtMs: Math.round(dt * 1000),
                framesDecoded: framesDecodedVal,
                bytesReceived: report.bytesReceived,
                pliCount: report.pliCount || 0,
                packetsLost: report.packetsLost || 0,
                jitterBufferDelay: report.jitterBufferDelay,
                jitterBufferEmittedCount: report.jitterBufferEmittedCount
              })
            } else if (newFrames > 0) {
              if (wasPaused) {
                debugInfo('[VideoTrace] decode-resume', {
                  ts: Date.now(),
                  newFrames,
                  framesDecoded: framesDecodedVal,
                  pliCount: report.pliCount || 0,
                  packetsLost: report.packetsLost || 0
                })
              }
              wasPaused = false
            }
          }

          const bitrate = dt > 0 ? ((report.bytesReceived - prevStats.bytesReceived) * 8 / dt / 1000).toFixed(0) : 0
          const jbDelay = jbDelayNum.toFixed(0)
          
          // Estimate E2E latency: RTT (network) + JB (buffer) + Decode (client) + 10ms (server processing)
          const e2eDelay = (currentRtt + jbDelayNum + decodeTimeNum + 10).toFixed(0)

          const pliCount = report.pliCount || 0
          const lostCount = report.packetsLost || 0

          prevStats = {
            timestamp: now,
            bytesReceived: report.bytesReceived,
            framesDecoded: framesDecodedVal
          }

          return { fps, bitrate, jbDelay, e2eDelay, rtt: currentRtt.toFixed(0), pliCount, pauseCount, lostCount, connectionType }
        }
      }
    } catch (e) {
      // ignore
    }
    return null
  }

  function resetStats() {
    prevStats = { timestamp: 0, bytesReceived: 0, framesDecoded: 0 }
    pauseCount = 0
    wasPaused = false
  }

  function setAudioMuted(muted) {
    audioMuted.value = Boolean(muted)
    if (audioElement) {
      audioElement.muted = audioMuted.value
    }
  }

  function toggleAudioMuted() {
    setAudioMuted(!audioMuted.value)
    return audioMuted.value
  }

  function sendForward(payload) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        message_type: 'forward',
        device_id: deviceId,
        payload
      }))
    }
  }

  function sendTouch(action, clientX, clientY, id = 0, rotatedCoord = null) {
    if (viewOnly) return
    if (!inputChannel || inputChannel.readyState !== 'open') return
    const activeEl = (isWebCodecsActive.value && canvasElementGetter) ? canvasElementGetter() : (videoElementGetter ? videoElementGetter() : null)
    if (!activeEl) return
    const videoW = activeEl.videoWidth || activeEl.width || DEVICE_W.value
    const videoH = activeEl.videoHeight || activeEl.height || DEVICE_H.value
    if (!videoW || !videoH) return
    const seq = ++touchSeq
    const clientTsMs = Date.now()

    const targetW = videoW
    const targetH = videoH

    let finalX, finalY

    // Use pre-calculated rotated coordinates if provided
    if (rotatedCoord && rotatedCoord.isRotated) {
      finalX = Math.max(0, Math.min(targetW, Math.round(rotatedCoord.x)))
      finalY = Math.max(0, Math.min(targetH, Math.round(rotatedCoord.y)))
    } else {
      // Standard calculation
      const rect = activeEl.getBoundingClientRect()
      const clientW = rect.width
      const clientH = rect.height

      // Calculate dimensions and offsets under object-fit: contain
      const videoRatio = videoW / videoH
      const clientRatio = clientW / clientH

      let actualW, actualH, offsetX, offsetY
      if (clientRatio > videoRatio) {
        // Pillarbox (left/right black bars)
        actualH = clientH
        actualW = clientH * videoRatio
        offsetX = (clientW - actualW) / 2
        offsetY = 0
      } else {
        // Letterbox (top/bottom black bars)
        actualW = clientW
        actualH = clientW / videoRatio
        offsetX = 0
        offsetY = (clientH - actualH) / 2
      }

      // Compute coordinate relative to actual video content
      const relativeX = clientX - rect.left - offsetX
      const relativeY = clientY - rect.top - offsetY

      // Map to device logical resolution
      const x = Math.round(relativeX / actualW * targetW)
      const y = Math.round(relativeY / actualH * targetH)

      // Boundary check
      finalX = Math.max(0, Math.min(targetW, x))
      finalY = Math.max(0, Math.min(targetH, y))
    }

    const msg = JSON.stringify({
      type: 'touch',
      id,
      seq,
      client_ts_ms: clientTsMs,
      action,
      x: finalX,
      y: finalY,
      w: targetW,
      h: targetH
    })

    const bufferedBefore = inputChannel.bufferedAmount
    inputChannel.send(msg)
    if (controlEventCallback) {
      controlEventCallback({
        type: 'touch',
        id,
        seq,
        client_ts_ms: clientTsMs,
        action,
        x: finalX,
        y: finalY,
        w: targetW,
        h: targetH
      })
    }
    const bufferedAfter = inputChannel.bufferedAmount
    if (action !== 2 || seq % 30 === 0 || bufferedAfter > 65536) {
      debugInfo('[TouchTrace] dc-send', {
        seq,
        action,
        id,
        x: finalX,
        y: finalY,
        w: targetW,
        h: targetH,
        clientTsMs,
        bufferedBefore,
        bufferedAfter
      })
    }
  }

  function sendScroll(clientX, clientY, scrollH, scrollV, rotatedCoord = null) {
    if (viewOnly) return
    debugLog('[sendScroll] called', 'inputChannel:', inputChannel?.readyState, 'scrollH:', scrollH, 'scrollV:', scrollV)
    if (!inputChannel || inputChannel.readyState !== 'open') {
      debugWarn('[sendScroll] blocked: channel not open, state:', inputChannel?.readyState)
      return false
    }
    const activeEl = (isWebCodecsActive.value && canvasElementGetter) ? canvasElementGetter() : (videoElementGetter ? videoElementGetter() : null)
    if (!activeEl) {
      debugWarn('[sendScroll] blocked: no active media element')
      return false
    }
    const videoW = activeEl.videoWidth || activeEl.width || DEVICE_W.value
    const videoH = activeEl.videoHeight || activeEl.height || DEVICE_H.value
    if (!videoW || !videoH) {
      debugWarn('[sendScroll] blocked: no valid dimensions', videoW, videoH)
      return false
    }

    const seq = ++touchSeq
    const clientTsMs = Date.now()

    const targetW = videoW
    const targetH = videoH

    let finalX, finalY

    if (rotatedCoord && rotatedCoord.isRotated) {
      finalX = Math.max(0, Math.min(targetW, Math.round(rotatedCoord.x)))
      finalY = Math.max(0, Math.min(targetH, Math.round(rotatedCoord.y)))
    } else {
      const rect = activeEl.getBoundingClientRect()
      const clientW = rect.width
      const clientH = rect.height

      const videoRatio = videoW / videoH
      const clientRatio = clientW / clientH

      let actualW, actualH, offsetX, offsetY
      if (clientRatio > videoRatio) {
        actualH = clientH
        actualW = clientH * videoRatio
        offsetX = (clientW - actualW) / 2
        offsetY = 0
      } else {
        actualW = clientW
        actualH = clientW / videoRatio
        offsetX = 0
        offsetY = (clientH - actualH) / 2
      }

      const relativeX = clientX - rect.left - offsetX
      const relativeY = clientY - rect.top - offsetY

      const x = Math.round(relativeX / actualW * targetW)
      const y = Math.round(relativeY / actualH * targetH)

      finalX = Math.max(0, Math.min(targetW, x))
      finalY = Math.max(0, Math.min(targetH, y))
    }

    const msg = JSON.stringify({
      type: 'inject_scroll',
      seq,
      client_ts_ms: clientTsMs,
      x: finalX,
      y: finalY,
      w: targetW,
      h: targetH,
      scroll_h: scrollH,
      scroll_v: scrollV
    })

    debugInfo('[ScrollTrace] dc-send', {
      seq,
      x: finalX,
      y: finalY,
      w: targetW,
      h: targetH,
      scrollH,
      scrollV
    })
    inputChannel.send(msg)
    if (controlEventCallback) {
      controlEventCallback({
        type: 'inject_scroll',
        seq,
        client_ts_ms: clientTsMs,
        x: finalX,
        y: finalY,
        w: targetW,
        h: targetH,
        scroll_h: scrollH,
        scroll_v: scrollV
      })
    }
    return true
  }

  function requestScreenshot() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        message_type: 'screenshot_request',
        device_id: deviceId
      }))
    }
  }

  let clipboardCallback = null
  function onClipboard(callback) {
    clipboardCallback = callback
  }

  function setClipboard(text, options = false) {
    if (viewOnly) return false
    const normalized = typeof options === 'boolean' ? { paste: options } : (options || {})
    if (clipboardChannel && clipboardChannel.readyState === 'open') {
      clipboardChannel.send(JSON.stringify({
        type: 'set_clipboard',
        text,
        paste: Boolean(normalized.paste),
        source: normalized.source || 'local',
        suppress_broadcast: Boolean(normalized.suppressBroadcast)
      }))
      return true
    }
    return false
  }

  function getClipboard() {
    if (viewOnly) return false
    if (clipboardChannel && clipboardChannel.readyState === 'open') {
      clipboardChannel.send(JSON.stringify({
        type: 'get_clipboard'
      }))
      return true
    }
    return false
  }

  let screenshotCallback = null

  function onScreenshot(callback) {
    screenshotCallback = callback
  }

  function handleScreenshot(data) {
    if (screenshotCallback) {
      screenshotCallback(data)
    }
  }

  function createAdbSessionChannel() {
    if (!pc || pc.readyState === 'closed') {
      throw new Error('WebRTC connection not ready')
    }
    debugLog('[ADB] Creating a new session DataChannel...')
    const channel = pc.createDataChannel('adb-channel', { ordered: true })
    channel.binaryType = 'arraybuffer'

    let channelLastOpenTime = 0
    let stabilizeTimer = null
    let sendQueue = []

    const flushQueue = () => {
      if (sendQueue.length > 0 && channel.readyState === 'open') {
        debugLog(`[ADB] Flushing ${sendQueue.length} queued send packets`)
        sendQueue.forEach(buf => {
          try {
            channel.send(buf)
          } catch (e) {
            console.error('[ADB] Failed to send buffered data:', e)
          }
        })
        sendQueue = []
      }
    }

    channel.onopen = () => {
      debugLog('[ADB] Session DataChannel OPEN')
      channelLastOpenTime = Date.now()
      if (!stabilizeTimer) {
        stabilizeTimer = setTimeout(() => {
          flushQueue()
          stabilizeTimer = null
        }, 150)
      }
    }

    channel.onclose = () => {
      debugLog('[ADB] Session DataChannel CLOSED')
      if (stabilizeTimer) {
        clearTimeout(stabilizeTimer)
        stabilizeTimer = null
      }
    }

    channel.onerror = (e) => {
      console.error('[ADB] Session DataChannel Error:', e)
      if (stabilizeTimer) {
        clearTimeout(stabilizeTimer)
        stabilizeTimer = null
      }
    }

    const sendData = (data) => {
      let buffer = null
      if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
        buffer = data
      } else if (data && data.buffer instanceof ArrayBuffer) {
        buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
      } else {
        return
      }

      const now = Date.now()
      const isStabilized = (now - channelLastOpenTime) > 150

      if (channel.readyState === 'open' && isStabilized) {
        try {
          channel.send(buffer)
        } catch (e) {
          console.error('[ADB] Send data failed, buffering instead:', e)
          sendQueue.push(buffer)
        }
      } else {
        sendQueue.push(buffer)
        if (channel.readyState === 'open' && !stabilizeTimer) {
          stabilizeTimer = setTimeout(() => {
            flushQueue()
            stabilizeTimer = null
          }, 150)
        }
      }
    }

    return {
      channel,
      sendData,
      close: () => {
        debugLog('[ADB] Closing session DataChannel')
        try {
          channel.close()
        } catch (e) {}
        if (stabilizeTimer) {
          clearTimeout(stabilizeTimer)
          stabilizeTimer = null
        }
        sendQueue = []
      }
    }
  }

  let fileChannel = null
  const fileChannelReady = ref(false)
  let fileChannelCallback = null

  function onFileChannelMessage(callback) {
    fileChannelCallback = callback
  }

  function setupFileChannel(channel) {
    channel.onopen = () => {
      debugLog('[FileChannel] DataChannel OPEN')
      fileChannelReady.value = true
    }
    channel.onmessage = (evt) => {
      if (fileChannelCallback) {
        fileChannelCallback(evt.data)
      }
    }
    channel.onclose = () => {
      debugLog('[FileChannel] DataChannel CLOSED')
      fileChannelReady.value = false
    }
    channel.onerror = (e) => {
      console.error('[FileChannel] DataChannel Error:', e)
      fileChannelReady.value = false
    }
  }

  function sendFileChannelCmd(cmd) {
    if (!fileChannel || fileChannel.readyState !== 'open') {
      console.warn('[DataChannel] sendFileChannelCmd failed: fileChannel is not open')
      return false
    }
    fileChannel.send(JSON.stringify(cmd))
    return true
  }

  function sendFileChannelChunk(arrayBuffer) {
    if (!fileChannel || fileChannel.readyState !== 'open') {
      console.warn('[DataChannel] sendFileChannelChunk failed: fileChannel is not open')
      return false
    }
    if (fileChannel.bufferedAmount > 512 * 1024) {
      return false // Buffer > 512KB triggers flow control backpressure
    }
    try {
      fileChannel.send(arrayBuffer)
      return true
    } catch (e) {
      console.error('[DataChannel] Error in sendFileChannelChunk:', e)
      return false
    }
  }

  function getFileChannelBufferedAmount() {
    return fileChannel ? fileChannel.bufferedAmount : 0
  }

  async function startCameraStreaming() {
    debugLog('[Camera] startCameraStreaming() called, camera option:', options.camera)
    if (!options.camera || !cameraSupport.value) {
      if (!cameraSupport.value) {
        debugWarn('[Camera] Intercepted camera streaming: device does not support camera')
      }
      return
    }
    stopCameraStreaming()

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const errMsg = 'Due to browser security restrictions, camera streaming requires a secure context (HTTPS or localhost). Please deploy with HTTPS or test on localhost.'
      console.error('[WebRTC] ' + errMsg)
      alert(errMsg)
      return
    }

    debugLog('[WebRTC] Requesting local camera stream...')
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: 640, 
          height: 480, 
          frameRate: 30,
          facingMode: { ideal: "environment" }
        }
      })
      debugLog('[WebRTC] Local camera stream acquired')
    } catch (err) {
      console.error('[WebRTC] Failed to acquire camera:', err)
      alert('Failed to obtain camera permission: ' + err.message)
      return
    }

    const video = document.createElement('video')
    video.autoplay = true
    video.playsInline = true
    video.muted = true
    video.srcObject = cameraStream
    
    try {
      await video.play()
    } catch (e) {
      console.warn('[WebRTC] Offscreen camera video play() failed:', e)
    }

    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 480
    const ctx = canvas.getContext('2d')

    cameraIntervalId = setInterval(() => {
      if (!cameraChannel || cameraChannel.readyState !== 'open') {
        stopCameraStreaming()
        return
      }

      ctx.drawImage(video, 0, 0, 640, 480)
      canvas.toBlob((blob) => {
        if (!blob || !cameraChannel || cameraChannel.readyState !== 'open') return
        const reader = new FileReader()
        reader.onload = () => {
          if (cameraChannel && cameraChannel.readyState === 'open') {
            cameraChannel.send(reader.result)
          }
        }
        reader.readAsArrayBuffer(blob)
      }, 'image/jpeg', 0.6)
    }, 1000 / 30)
  }

  function stopCameraStreaming() {
    if (cameraIntervalId) {
      clearInterval(cameraIntervalId)
      cameraIntervalId = null
    }
    if (cameraStream) {
      try {
        cameraStream.getTracks().forEach(track => track.stop())
      } catch (e) {}
      cameraStream = null
    }
    debugLog('[WebRTC] Camera streaming stopped and tracks released')
  }

  function disconnect() {
    stopCameraStreaming()
    if (webcodecsRenderer) {
      webcodecsRenderer.stop()
      webcodecsRenderer = null
      isWebCodecsActive.value = false
    }
    if (pc) {
      pc.close()
      pc = null
    }
    const video = videoElementGetter ? videoElementGetter() : null
    if (video) {
      video.srcObject = null
    }
    videoStream = null
    cleanupAudioPlayback()
    if (ws) {
      ws.close()
      ws = null
    }
    if (fileChannel) {
      try { fileChannel.close() } catch(e) {}
      fileChannel = null
    }
    fileChannelReady.value = false
    if (aiCommandChannel) {
      try { aiCommandChannel.close() } catch(e) {}
      aiCommandChannel = null
    }
    aiCommandPromises.clear()
    status.value = 'disconnected'

    if (webrtcObj) {
      webrtcObj._adbInstance = null
      webrtcObj._adbTransport = null
      webrtcObj._adbRawConnection = null
      webrtcObj._adbActiveSocketsCount = 0
    }
  }

  onUnmounted(() => {
    disconnect()
  })

  // Set function to retrieve video element (invoked by component)
  function setVideoGetter(getter) {
    videoElementGetter = getter
  }

  // Set function to retrieve canvas element (WebCodecs mode)
  function setCanvasGetter(getter) {
    canvasElementGetter = getter
  }

  function sendInjectText(text) {
    if (viewOnly) return
    if (!inputChannel || inputChannel.readyState !== 'open') {
      console.warn('[DataChannel] sendInjectText failed: inputChannel is not open')
      return false
    }
    console.log('[DataChannel] Sending inject_text:', text)
    const eventObj = {
      type: 'inject_text',
      text
    }
    const msg = JSON.stringify(eventObj)
    inputChannel.send(msg)
    if (controlEventCallback) {
      controlEventCallback(eventObj)
    }
    return true
  }

  function sendInjectKeycode(action, keycode, repeat = 0, meta = 0) {
    if (viewOnly) return
    if (!inputChannel || inputChannel.readyState !== 'open') {
      console.warn('[DataChannel] sendInjectKeycode failed: inputChannel is not open')
      return false
    }
    console.log('[DataChannel] Sending inject_keycode:', { action, keycode, repeat, meta })
    const eventObj = {
      type: 'inject_keycode',
      action,
      keycode,
      repeat,
      meta
    }
    const msg = JSON.stringify(eventObj)
    inputChannel.send(msg)
    if (controlEventCallback) {
      controlEventCallback(eventObj)
    }
    return true
  }

  let frameSizeCallback = null
  function onFrameSize(cb) {
    frameSizeCallback = cb
  }

  function onControlEvent(cb) {
    controlEventCallback = cb
  }

  webrtcObj = {
    status,
    onControlEvent,
    onFrameSize,
    error,
    audioMuted,
    cameraSupport,
    agentVersion,
    isWebCodecsActive,
    setVideoGetter,
    setCanvasGetter,
    connect,
    disconnect,
    sendTouch,
    sendScroll,
    requestScreenshot,
    onScreenshot,
    sendCommand,
    executeCommand,
    executeCommandP2P,
    createAiCommandChannel,
    onCommandResult,
    sendInjectData,
    createAdbSessionChannel,
    getVideoStats,
    resetStats,
    setAudioMuted,
    toggleAudioMuted,
    onClipboard,
    setClipboard,
    getClipboard,
    sendInjectText,
    sendInjectKeycode,
    fileChannelReady,
    onFileChannelMessage,
    sendFileChannelCmd,
    sendFileChannelChunk,
    getFileChannelBufferedAmount
  }

  return webrtcObj
}
