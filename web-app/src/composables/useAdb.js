import { ref } from 'vue'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { debugLog } from '@/utils/debug'

export function useAdb(webrtc) {
  const isAdbConnected = ref(false)
  let term = null
  let fitAddon = null
  let sessionChannel = null

  async function initAdb(container) {
    if (isAdbConnected.value) return

    term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: 'Consolas, "Liberation Mono", Menlo, Courier, monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#aeafad'
      },
      scrollback: 10000
    })
    fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(container)
    setTimeout(() => { if (fitAddon) try { fitAddon.fit() } catch (e) {} }, 100)

    term.writeln('\x1b[33m[Shell] Establishing WebRTC terminal channel...\x1b[0m')

    try {
      if (typeof webrtc.createAdbSessionChannel !== 'function') {
        throw new Error('WebRTC interface does not support session channel factory')
      }
      
      // Create dedicated DataChannel instance for this session
      sessionChannel = webrtc.createAdbSessionChannel()

      // Wait 150ms to ensure DataChannel stability
      await new Promise(r => setTimeout(r, 150))

      term.writeln('\x1b[33m[Shell] Initializing interactive terminal session...\x1b[0m')

      // Send window rows/cols payload to run raw PTY stream
      const cols = term.cols || 80
      const rows = term.rows || 24
      const initPayload = JSON.stringify({ type: 'init', rows, cols })
      sessionChannel.sendData(new TextEncoder().encode(initPayload))

      term.writeln('\x1b[32m[Shell] Terminal session ready\x1b[0m\r\n')
      isAdbConnected.value = true
      setTimeout(() => { if (fitAddon) try { fitAddon.fit() } catch (e) {} }, 200)

      // Bind incoming channel byte stream to terminal
      sessionChannel.channel.onmessage = (evt) => {
        if (term) {
          term.write(new Uint8Array(evt.data))
        }
      }

      // Bind keyboard input to session channel
      term.onData((data) => {
        if (sessionChannel) {
          sessionChannel.sendData(new TextEncoder().encode(data))
        }
      })

    } catch (e) {
      console.error('[Shell] Connection failed:', e)
      if (term) term.writeln(`\r\n\x1b[31m[Shell] Connection failed: ${e.message}\x1b[0m`)
      isAdbConnected.value = false
    }
  }

  async function closeAdb() {
    debugLog('[Shell] Closing session')
    isAdbConnected.value = false

    if (sessionChannel) {
      sessionChannel.close()
      sessionChannel = null
    }

    if (term) {
      const t = term
      term = null
      fitAddon = null
      try { t.dispose() } catch (e) {}
    }
  }

  function resize() {
    if (fitAddon) {
      try { fitAddon.fit() } catch (e) {}
    }
  }

  return { isAdbConnected, initAdb, closeAdb, resize }
}
