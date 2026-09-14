import { ref } from 'vue'
import { Adb, AdbDaemonTransport } from '@yume-chan/adb'
import { AdbDaemonWebUsbDeviceManager } from '@yume-chan/adb-daemon-webusb'

export function useDeploy() {
  const isDeploying = ref(false)
  const deployStatus = ref('')
  const deployProgress = ref(0)
  const deployError = ref(null)
  const deployLog = ref([])

  function log(msg) {
    const ts = new Date().toLocaleTimeString()
    deployLog.value.push(`[${ts}] ${msg}`)
  }

  /**
   * @param {Object} options
   * @param {string} options.signalingUrl - Required
   * @param {string} [options.deviceId] - Optional
   * @param {number} [options.maxFps=0] - Optional, max video fps, 0=unlimited
   * @param {string} [options.videoCodecOptions=''] - Optional, scrcpy video_codec_options
   * @param {string} [options.externalAddr=''] - Optional, external address
   * @param {string} [options.webrtcPort=''] - Optional, WebRTC port
   * @param {string} [options.iceServers=''] - Optional, ICE Servers URLs
   */
  async function deployAgent(options) {
    const {
      signalingUrl,
      deviceId,
      maxFps = 0,
      videoCodecOptions = '',
      externalAddr = '',
      webrtcPort = '',
      iceServers = '',
    } = options

    if (!signalingUrl) throw new Error('Signaling server address is required (Domain or IP:Port)')

    let formattedSignalingUrl = signalingUrl.trim()
    if (formattedSignalingUrl.startsWith('https://')) {
      formattedSignalingUrl = 'wss://' + formattedSignalingUrl.slice(8)
    } else if (formattedSignalingUrl.startsWith('http://')) {
      formattedSignalingUrl = 'ws://' + formattedSignalingUrl.slice(7)
    } else if (!formattedSignalingUrl.startsWith('ws://') && !formattedSignalingUrl.startsWith('wss://')) {
      const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://'
      formattedSignalingUrl = protocol + formattedSignalingUrl
    }

    isDeploying.value = true
    deployError.value = null
    deployProgress.value = 0
    deployLog.value = []

    let transport = null

    try {
      const AdbWebCredentialStore = (await import('@yume-chan/adb-credential-web')).default
      const credentialStore = new AdbWebCredentialStore('cloudphone-web')

      // Step 1: Connect USB device
      log('Requesting USB device connection...')
      deployStatus.value = 'Please select a USB device...'
      const device = await AdbDaemonWebUsbDeviceManager.BROWSER.requestDevice()
      if (!device) throw new Error('No device selected')

      log(`Device selected: ${device.name}`)
      deployStatus.value = `Connecting to ${device.name}...`
      const connection = await device.connect()
      log('USB connection established')

      // Step 2: ADB Authentication
      deployStatus.value = 'Authenticating, please accept prompt on phone screen...'
      log('Performing ADB authentication...')
      transport = await AdbDaemonTransport.authenticate({
        serial: device.serial || 'webadb',
        connection,
        credentialStore,
      })

      const adb = new Adb(transport)
      deployProgress.value = 20
      log('ADB authentication successful')

      // Step 3: Detect architecture
      deployStatus.value = 'Detecting device architecture...'
      log('Detecting CPU architecture...')
      const abi = await adb.subprocess.noneProtocol.spawnWaitText('getprop ro.product.cpu.abi')
      let arch = 'amd64'
      let agentPath = '/agent/cloudphone-agent-amd64'
      if (abi.includes('arm64') || abi.includes('aarch64')) {
        arch = 'arm64'
        agentPath = '/agent/cloudphone-agent-arm64'
      } else if (abi.includes('arm') || abi.includes('armeabi')) {
        arch = 'armeabi-v7a'
        agentPath = '/agent/cloudphone-agent-armeabi-v7a'
      }
      log(`Device architecture: ${abi.trim()} -> using ${arch} binary`)
      deployProgress.value = 40

      // Step 4: Push files
      deployStatus.value = 'Pushing Agent binary...'
      log('Downloading agent and libsys_core.so...')
      const [agentResp, jarResp] = await Promise.all([fetch(agentPath), fetch('/agent/libsys_core.so')])
      if (!agentResp.ok) throw new Error(`Failed to download agent: ${agentResp.status}`)
      if (!jarResp.ok) throw new Error(`Failed to download libsys_core.so: ${jarResp.status}`)

      log('Pushing files to device...')
      const sync = await adb.sync()
      try {
        await sync.write({
          filename: '/data/local/tmp/cloudphone-agent',
          file: agentResp.body,
          permission: 0o755,
        })
        log('cloudphone-agent pushed')
        deployProgress.value = 60
        await sync.write({
          filename: '/data/local/tmp/libsys_core.so',
          file: jarResp.body,
          permission: 0o644,
        })
        log('libsys_core.so pushed')
      } finally {
        await sync.dispose()
      }
      deployProgress.value = 80

      // Step 5: Start service
      deployStatus.value = 'Starting service in background...'
      log('Terminating previous processes...')
      const killSocket = await adb.createSocket('shell:killall cloudphone-agent 2>/dev/null; true')
      await killSocket.closed

      const logPath = '/data/local/tmp/cloudphone-agent.log'
      const cloudphoneAgent = '/data/local/tmp/cloudphone-agent'

      await adb.subprocess.noneProtocol.spawnWaitText(`chmod 755 ${cloudphoneAgent}`)

      // Build launch parameters
      const args = [
        `-signaling ${formattedSignalingUrl}`,
        '-jar /data/local/tmp/libsys_core.so'
      ]
      if (deviceId) args.push(`-id ${deviceId}`)
      if (maxFps > 0) args.push(`-max-fps ${maxFps}`)
      if (videoCodecOptions) args.push(`-video-codec-options "${videoCodecOptions}"`)
      if (externalAddr) args.push(`-external-addr ${externalAddr}`)
      if (webrtcPort) args.push(`-webrtc-port ${webrtcPort}`)
      if (iceServers) args.push(`-ice-servers "${iceServers}"`)
      const argsStr = args.join(' ')

      const fullCommand = `sh -c "export CP_AGENT_JAR=/data/local/tmp/libsys_core.so; exec setsid nohup env GODEBUG=asyncpreemptoff=1 ${cloudphoneAgent} ${argsStr} > ${logPath} 2>&1 & sleep 0.5"`
      log(`Launch command: ${cloudphoneAgent} ${argsStr}`)

      const startSocket = await adb.createSocket(`shell:${fullCommand}`)
      const reader2 = startSocket.readable.getReader()
      while (true) {
        const { done } = await reader2.read()
        if (done) break
      }

      await new Promise(r => setTimeout(r, 1000))
      log('Waiting for process to start...')

      // Verify process
      const checkResult = await adb.subprocess.noneProtocol.spawnWaitText('pidof cloudphone-agent || echo NOTFOUND')
      if (checkResult.trim() === 'NOTFOUND' || checkResult.trim() === '') {
        const logContent = await adb.subprocess.noneProtocol.spawnWaitText(`cat ${logPath} 2>/dev/null`)
        log(`Launch failed, logs: ${logContent.trim()}`)
        throw new Error(`Agent failed to start\n${logContent}`)
      }

      log(`Process started, PID: ${checkResult.trim()}`)
      deployStatus.value = 'Deployment successful!'
      deployProgress.value = 100
      log('Deployment complete!')
      return true
    } catch (e) {
      let msg = e.message || String(e)
      if (/already in use/i.test(msg) || /already in used/i.test(msg) || /already claimed/i.test(msg) || /unable to claim/i.test(msg) || /device busy/i.test(msg)) {
        msg = `USB device is already in use by another program (usually local ADB daemon or phone assistant).\n💡 Solution: Run "adb kill-server" in your terminal, close any phone management software, and retry.`
      }
      deployError.value = msg
      deployStatus.value = 'Deployment failed'
      log(`Error: ${msg}`)
      return false
    } finally {
      isDeploying.value = false
      if (transport) try { await transport.close() } catch (err) {}
    }
  }

  return { isDeploying, deployStatus, deployProgress, deployError, deployLog, deployAgent }
}
