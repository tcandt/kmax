/**
 * WebCodecs + Canvas Ultra-Low-Latency Phase-Locked Renderer
 * 
 * Architectural Principles:
 * 1. Uses WebRTC Insertable Streams (receiver.createEncodedStreams()) to intercept raw H.264 encoded frames at UDP ingress;
 * 2. Uses WebCodecs VideoDecoder to directly invoke underlying hardware decoders (< 0.5ms);
 * 3. Binds to physical display VSync via requestAnimationFrame for 1:1 phase-locked rendering on Canvas (desynchronized);
 * 4. Completely bypasses HTML5 <video> 4-tier IPC scheduling and JitterBuffer queuing, achieving native scrcpy (SDL2) fluidity.
 */

export class WebCodecsRenderer {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement
    // Enabling desynchronized: true allows bypassing browser double-buffering and compositing for direct GPU draw
    this.ctx = canvasElement.getContext("2d", {
      alpha: false,
      desynchronized: true
    })
    this.options = options
    this.decoder = null
    this.reader = null
    this.running = false
    this.animId = null
    this.latestFrame = null
    this.hasNewFrame = false
    this.codecConfigured = false
    this.onFrameSizeChange = options.onFrameSizeChange || null
    this.fpsCount = 0
    this.lastFpsTime = performance.now()
    this.currentFps = 60
    this.totalFramesDecoded = 0
    this.totalFramesRendered = 0
  }

  static isSupported() {
    return typeof window !== "undefined" &&
           typeof window.VideoDecoder !== "undefined" &&
           typeof window.EncodedVideoChunk !== "undefined" &&
           typeof window.RTCPeerConnection !== "undefined" &&
           typeof window.RTCRtpReceiver !== "undefined"
  }

  initDecoder() {
    if (!WebCodecsRenderer.isSupported()) {
      throw new Error("WebCodecs or Insertable Streams not supported")
    }

    if (this.decoder && this.decoder.state !== "closed") {
      try {
        this.decoder.close()
      } catch (e) {}
    }

    this.decoder = new VideoDecoder({
      output: (videoFrame) => {
        this.totalFramesDecoded++
        if (this.latestFrame) {
          this.latestFrame.close()
        }
        this.latestFrame = videoFrame
        this.hasNewFrame = true
      },
      error: (err) => {
        console.error("[WebCodecs] Hardware decoder error:", err)
        // Reset state on error
        this.codecConfigured = false
      }
    })

    // Default configuration H.264 Constrained Baseline / Main (zero-latency optimized)
    try {
      this.decoder.configure({
        codec: "avc1.42002a", // H.264 Baseline Level 4.2
        optimizeForLatency: true,
        hardwareAcceleration: "prefer-hardware"
      })
      this.codecConfigured = true
    } catch (e) {
      console.warn("[WebCodecs] Initial configure fallback:", e)
    }
  }

  start(receiver) {
    if (!receiver || !receiver.createEncodedStreams) {
      console.warn("[WebCodecs] receiver.createEncodedStreams is not available")
      return false
    }

    try {
      this.initDecoder()
      this.running = true

      const { readable } = receiver.createEncodedStreams()
      this.reader = readable.getReader()

      // Start stream consumption pump loop
      this.pumpStream()

      // Start VSync phase-locked render loop
      this.startRenderLoop()

      return true
    } catch (err) {
      console.error("[WebCodecs] Failed to start renderer:", err)
      this.stop()
      return false
    }
  }

  async pumpStream() {
    try {
      while (this.running && this.reader) {
        const { value, done } = await this.reader.read()
        if (done) break
        if (!value || !value.data || value.data.byteLength === 0) continue

        // value is RTCEncodedVideoFrame
        const isKey = value.type === "key"

        // If not yet configured, wait for initial IDR keyframe
        if (!this.codecConfigured && !isKey) {
          continue
        }

        try {
          const chunk = new EncodedVideoChunk({
            type: isKey ? "key" : "delta",
            timestamp: value.timestamp,
            data: value.data
          })

          if (this.decoder && this.decoder.state === "configured") {
            this.decoder.decode(chunk)
          }
        } catch (decodeErr) {
          console.warn("[WebCodecs] Decode chunk error:", decodeErr)
        }
      }
    } catch (err) {
      if (this.running) {
        console.error("[WebCodecs] pumpStream error:", err)
      }
    }
  }

  startRenderLoop() {
    const render = () => {
      if (!this.running) return

      if (this.hasNewFrame && this.latestFrame) {
        const frame = this.latestFrame
        this.hasNewFrame = false

        // Dynamically align Canvas physical resolution
        if (this.canvas.width !== frame.displayWidth || this.canvas.height !== frame.displayHeight) {
          this.canvas.width = frame.displayWidth
          this.canvas.height = frame.displayHeight
          if (this.onFrameSizeChange) {
            this.onFrameSizeChange(frame.displayWidth, frame.displayHeight)
          }
        }

        // ⚡ Direct GPU Draw with physical VSync phase locking
        this.ctx.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height)

        // Real-time framerate statistics
        this.fpsCount++
        const now = performance.now()
        if (now - this.lastFpsTime >= 1000) {
          this.currentFps = Math.round((this.fpsCount * 1000) / (now - this.lastFpsTime))
          this.fpsCount = 0
          this.lastFpsTime = now
        }
      }

      this.animId = requestAnimationFrame(render)
    }

    this.animId = requestAnimationFrame(render)
  }

  stop() {
    this.running = false
    if (this.animId) {
      cancelAnimationFrame(this.animId)
      this.animId = null
    }
    if (this.reader) {
      try {
        this.reader.cancel()
      } catch (e) {}
      this.reader = null
    }
    if (this.decoder) {
      try {
        if (this.decoder.state !== "closed") {
          this.decoder.close()
        }
      } catch (e) {}
      this.decoder = null
    }
    if (this.latestFrame) {
      try {
        this.latestFrame.close()
      } catch (e) {}
      this.latestFrame = null
    }
    this.codecConfigured = false
  }
}
