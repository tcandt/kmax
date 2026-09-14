<template>
  <div class="deploy-page">
    <div class="deploy-layout">
      <!-- Left: Parameter form -->
      <section class="form-section">
        <h2 class="section-title">Web-Based One-Click USB Deployment</h2>

        <div class="webusb-warning">
          ⚠️ <b>Notice</b>: WebUSB deployment requires a physical USB cable connection. <b>Wireless or network ADB modes are not supported</b>.<br>
          💡 <b>Troubleshooting</b>: If you see <i>"already in use"</i>, another local ADB process or phone assistant is running. Run <code>adb kill-server</code> in your terminal and retry.
        </div>

        <div class="form-group">
          <label class="form-label">Signaling Address <span class="required">*</span></label>
          <input
            v-model="form.signalingUrl"
            class="form-input"
            placeholder="e.g. wss://cloudphone.example.com:8443 or wss://192.168.1.2:8443"
          >
          <div class="form-hint">Signaling server address (domain or IP, protocol auto-completed). e.g.:<br>Domain/TLS: <code>wss://cloudphone.example.com:8443</code><br>LAN IP: <code>ws://192.168.1.2:8443</code></div>
        </div>

        <div class="form-group">
          <label class="form-label">ICE Servers Address</label>
          <input
            v-model="form.iceServers"
            class="form-input"
            placeholder="stun:stun.l.google.com:19302"
          >
          <div class="form-hint">Custom ICE servers (comma-separated), e.g. stun:stun.l.google.com:19302,turn:user:pass@host:port</div>
        </div>

        <div class="form-group">
          <label class="form-label">Device ID</label>
          <input
            v-model="form.deviceId"
            class="form-input"
            placeholder="Leave blank to auto-generate"
          >
        </div>

        <div class="form-group">
          <label class="form-label">Encoder Options</label>
          <input
            v-model="form.videoCodecOptions"
            class="form-input"
            placeholder="Leave blank for defaults"
          >
          <div class="form-hint">Default: intra-refresh-period=30,i-frame-interval=2,vendor.rtc-ext-enc-low-latency=1</div>
        </div>

        <div class="form-group">
          <label class="form-label">External Addr</label>
          <input
            v-model="form.externalAddr"
            class="form-input"
            placeholder="Leave blank if not needed"
          >
          <div class="form-hint">For non-direct environments, enter the host IP forwarding ports (e.g. redroid host IP).</div>
        </div>

        <div class="form-group">
          <label class="form-label">WebRTC Port</label>
          <input
            v-model="form.webrtcPort"
            class="form-input"
            placeholder="Leave blank for default 50000"
          >
        </div>

        <button
          class="deploy-btn"
          :disabled="isDeploying || !form.signalingUrl"
          @click="startDeploy"
        >
          {{ isDeploying ? 'Deploying...' : 'Connect USB Device & Deploy' }}
        </button>
      </section>

      <!-- Right: Progress & Manual Deployment Guides -->
      <div class="right-column">
        <!-- Deployment log / progress -->
        <section class="log-section">
          <h2 class="section-title">USB Automated Deployment Progress</h2>

          <!-- Steps list -->
          <div class="steps">
            <div v-for="(step, i) in steps" :key="i" class="step" :class="stepClass(i)">
              <span class="step-icon">{{ stepIcon(i) }}</span>
              <span class="step-label">{{ step }}</span>
            </div>
          </div>

          <!-- Progress bar -->
          <div class="progress-bar" v-if="isDeploying || deployProgress > 0">
            <div class="progress-inner" :style="{ width: deployProgress + '%' }"></div>
          </div>

          <!-- Status -->
          <div v-if="deployStatus" class="status-line" :class="{ error: deployError, success: deployProgress === 100 }">
            {{ deployStatus }}
          </div>

          <!-- Log area -->
          <div class="log-area" ref="logArea">
            <div v-if="deployLog.length === 0" class="log-empty">Waiting to deploy...</div>
            <div v-for="(line, i) in deployLog" :key="i" class="log-line">{{ line }}</div>
          </div>
        </section>

        <!-- Manual Deployment & CLI Guide -->
        <section class="manual-section">
          <div class="manual-header">
            <h2 class="section-title">Standalone Deployment & Configuration Guide</h2>
            <!-- Mode Tabs -->
            <div class="deploy-mode-tabs">
              <button 
                class="mode-tab-btn" 
                :class="{ active: manualMode === 'adb' }" 
                @click="manualMode = 'adb'"
              >
                💻 Computer ADB One-Click Deployment (No Root)
              </button>
              <button 
                class="mode-tab-btn magisk-tab" 
                :class="{ active: manualMode === 'magisk' }" 
                @click="manualMode = 'magisk'"
              >
                📱 Magisk / KSU Module (Root Auto-Start)
              </button>
            </div>
          </div>

          <!-- Option 1: Computer ADB Deployment -->
          <div v-if="manualMode === 'adb'" class="manual-mode-block">
            <div class="manual-prereqs">
              <div class="qs-prereq-title">📋 Prerequisites for ADB Deployment:</div>
              <ul class="qs-prereq-list">
                <li><b>Device Settings</b>: Enable <b>"USB Debugging"</b> in Settings -> Developer Options and connect via USB.</li>
                <li><b>Host Setup</b>: Ensure <b>ADB tools</b> are installed on your computer (run <code>adb devices</code> to verify).</li>
              </ul>
            </div>
            
            <div class="manual-layout">
              <div class="manual-download-col">
                <h3 class="manual-subtitle">Step 1: Download ADB Deployment Package</h3>
                <div class="download-row">
                  <a href="/downloads/agent-deploy.zip" download="agent-deploy.zip" class="download-card-btn gold-card">
                    <div class="card-title">⚡ ADB One-Click Deployment Package (ZIP)</div>
                    <div class="card-desc">Contains multi-arch Agent binaries, core streaming library, and run scripts.</div>
                  </a>
                </div>
              </div>

              <div class="manual-guide-col">
                <h3 class="manual-subtitle">Step 2: Run Deployment Script</h3>
                <div class="guide-steps">
                  <div class="guide-step-item">
                    <span class="step-num">1</span>
                    <div class="step-content">
                      <p>Unzip <code>agent-deploy.zip</code> and execute the script matching your operating system:</p>
                      
                      <div class="deploy-script-tabs">
                        <div class="script-box-title">Linux / macOS (Unix ADB)</div>
                        <div class="code-container">
                          <pre class="code-block wrap">chmod +x run.sh && {{ shCommand }}</pre>
                          <button class="copy-code-btn" @click="copyCommand(`chmod +x run.sh && ${shCommand}`)">Copy</button>
                        </div>

                        <div class="script-box-title" style="margin-top: 12px;">Windows CMD (ADB)</div>
                        <div class="code-container">
                          <pre class="code-block wrap">{{ batCommand }}</pre>
                          <button class="copy-code-btn" @click="copyCommand(batCommand)">Copy</button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="guide-step-item">
                    <span class="step-num">2</span>
                    <div class="step-content">
                      <p>Verify Agent process status and logs in terminal:</p>
                      <pre class="code-block"># Verify if Agent background process is online
adb shell "ps -A | grep cloudphone-agent"

# View Agent service logs
adb shell "cat /data/local/tmp/cloudphone-agent.log"</pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Option 2: Magisk / KernelSU / APatch Module -->
          <div v-else-if="manualMode === 'magisk'" class="manual-mode-block">
            <div class="manual-prereqs magisk-prereqs">
              <div class="qs-prereq-title magisk-title">📋 Prerequisites for Magisk Module:</div>
              <ul class="qs-prereq-list">
                <li><b>Requirements</b>: Device must be <b>rooted</b> with Magisk, KernelSU, or APatch installed.</li>
                <li><b>Advantages</b>: Runs as an auto-starting system background service with automatic persistence on boot.</li>
              </ul>
            </div>
            
            <div class="manual-layout">
              <div class="manual-download-col">
                <h3 class="manual-subtitle">Step 1: Download Magisk Module</h3>
                <div class="download-row">
                  <a href="/agent/cloudphone-agent-magisk.pkg" download="cloudphone-agent-magisk.zip" class="download-card-btn magisk-card">
                    <div class="card-title">📱 Magisk / KSU Module (ZIP)</div>
                    <div class="card-desc">Dedicated module package with multi-arch support, watchdog daemon, and cpctl CLI.</div>
                  </a>
                </div>
              </div>

              <div class="manual-guide-col">
                <h3 class="manual-subtitle">Step 2: Flash Module & Configure</h3>
                <div class="guide-steps">
                  <div class="guide-step-item">
                    <span class="step-num">1</span>
                    <div class="step-content">
                      <p><b>Flash Module</b>: Install <code>cloudphone-agent-magisk.zip</code> in Magisk / KernelSU and <b>reboot device</b>.</p>
                    </div>
                  </div>

                  <div class="guide-step-item">
                    <span class="step-num">2</span>
                    <div class="step-content">
                      <p><b>Configure Signaling Server and ICE Relay</b> (choose any of the following methods):</p>
                      <div class="deploy-script-tabs">
                        <div class="script-box-title" style="color: #a855f7;">Method A: Command Line Configuration (Terminal / ADB shell)</div>
                        <div class="code-container">
                          <pre class="code-block wrap">{{ magiskCommand }}</pre>
                          <button class="copy-code-btn" @click="copyCommand(magiskCommand)">Copy</button>
                        </div>
                      </div>
                      <p style="margin-top: 10px; font-size: 12px; color: var(--text-secondary); line-height: 1.6;">
                        • <b>Set ICE Servers (Optional)</b>: <code>cpctl set CP_AGENT_ICE_SERVERS "&lt;turn/stun url&gt;"</code> (leave empty for LAN).<br>
                        • <b>Method B (Interactive Menu)</b>: Run <code>su</code> then <code>cpctl</code> in terminal to access menu option 4.<br>
                        • <b>Method C (Edit Config)</b>: Edit <code>/data/adb/modules/cloudphone-agent/config.conf</code>, update configuration fields, and click the Magisk Action button twice to reload.
                      </p>
                    </div>
                  </div>

                  <div class="guide-step-item">
                    <span class="step-num">3</span>
                    <div class="step-content">
                      <p>Verify Magisk module service status:</p>
                      <pre class="code-block"># Check service status
adb shell "su -c cpctl status"   # Or run: su -> cpctl in terminal

# View logs
adb shell "cat /data/local/tmp/cloudphone-agent.log"</pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, nextTick, onMounted, computed } from 'vue'
import { useDeploy } from '@/composables/useDeploy'

const { isDeploying, deployStatus, deployProgress, deployError, deployLog, deployAgent } = useDeploy()

const logArea = ref(null)
const manualMode = ref('adb') // 'adb' | 'magisk'

const form = reactive({
  signalingUrl: '',
  deviceId: '',
  maxFps: 60,
  videoCodecOptions: '',
  externalAddr: '',
  webrtcPort: '',
  iceServers: '',
})

const steps = ['Connect USB Device', 'ADB Authentication', 'Detect Architecture', 'Push Binaries', 'Start Agent Service']

function currentStep() {
  if (deployProgress.value >= 100) return 5
  if (deployProgress.value >= 80) return 4
  if (deployProgress.value >= 40) return 3
  if (deployProgress.value >= 20) return 2
  if (isDeploying.value) return 0
  return -1
}

function stepClass(i) {
  const cur = currentStep()
  if (deployError.value && i === cur) return 'error'
  if (i < cur) return 'done'
  if (i === cur) return 'active'
  return ''
}

function stepIcon(i) {
  const cur = currentStep()
  if (deployError.value && i === cur) return '✗'
  if (i < cur) return '✓'
  if (i === cur) return '⟳'
  return '○'
}

// Auto scroll logs
watch(deployLog, async () => {
  await nextTick()
  if (logArea.value) {
    logArea.value.scrollTop = logArea.value.scrollHeight
  }
}, { deep: true })

async function startDeploy() {
  localStorage.setItem('signalingAddr', form.signalingUrl)
  await deployAgent({
    signalingUrl: form.signalingUrl,
    deviceId: form.deviceId || undefined,
    maxFps: form.maxFps,
    videoCodecOptions: form.videoCodecOptions || undefined,
    externalAddr: form.externalAddr || undefined,
    webrtcPort: form.webrtcPort || undefined,
    iceServers: form.iceServers || undefined,
  })
}

// Extract current signaling IP and port
const signalingIp = computed(() => {
  let url = (form.signalingUrl || '').trim()
  url = url.replace('https://', '').replace('http://', '').replace('wss://', '').replace('ws://', '')
  return url || window.location.host
})

// Generate Unix/macOS deploy command
const shCommand = computed(() => {
  const host = signalingIp.value
  const ip = host.split(':')[0] || '127.0.0.1'
  const isPlain = form.signalingUrl.startsWith('ws://') || form.signalingUrl.startsWith('http://')
  const protocol = isPlain ? 'ws' : 'wss'
  const deviceIdArg = form.deviceId ? ` -id ${form.deviceId}` : ''
  const maxFpsArg = form.maxFps > 0 ? ` -max-fps ${form.maxFps}` : ''
  const codecArg = form.videoCodecOptions ? ` -video-codec-options "${form.videoCodecOptions}"` : ''
  const extArg = form.externalAddr ? ` -external-addr ${form.externalAddr}` : ''
  const portArg = form.webrtcPort ? ` -webrtc-port ${form.webrtcPort}` : ''
  
  let iceServersArg = ` -ice-servers "turn:cloudphone_user:cloudphone_secure_password@${ip}:3478?transport=udp,stun:${ip}:3478"`
  if (form.iceServers) {
    iceServersArg = ` -ice-servers "${form.iceServers}"`
  }

  return `./run.sh${deviceIdArg} -signaling "${protocol}://${host}"${maxFpsArg}${codecArg}${extArg}${portArg}${iceServersArg}`
})

// Generate Windows CMD deploy command
const batCommand = computed(() => {
  const host = signalingIp.value
  const ip = host.split(':')[0] || '127.0.0.1'
  const isPlain = form.signalingUrl.startsWith('ws://') || form.signalingUrl.startsWith('http://')
  const protocol = isPlain ? 'ws' : 'wss'
  const deviceIdArg = form.deviceId ? ` -id ${form.deviceId}` : ''
  const maxFpsArg = form.maxFps > 0 ? ` -max-fps ${form.maxFps}` : ''
  const codecArg = form.videoCodecOptions ? ` -video-codec-options "${form.videoCodecOptions}"` : ''
  const extArg = form.externalAddr ? ` -external-addr ${form.externalAddr}` : ''
  const portArg = form.webrtcPort ? ` -webrtc-port ${form.webrtcPort}` : ''
  
  let iceServersArg = ` -ice-servers "turn:cloudphone_user:cloudphone_secure_password@${ip}:3478?transport=udp,stun:${ip}:3478"`
  if (form.iceServers) {
    iceServersArg = ` -ice-servers "${form.iceServers}"`
  }

  return `run.bat${deviceIdArg} -signaling "${protocol}://${host}"${maxFpsArg}${codecArg}${extArg}${portArg}${iceServersArg}`
})

// Generate Magisk / KSU command
const magiskCommand = computed(() => {
  const host = signalingIp.value
  const ip = host.split(':')[0] || '127.0.0.1'
  const isPlain = form.signalingUrl.startsWith('ws://') || form.signalingUrl.startsWith('http://')
  const protocol = isPlain ? 'ws' : 'wss'
  const sig = `${protocol}://${host}`
  const iceServersVal = form.iceServers || `turn:cloudphone_user:cloudphone_secure_password@${ip}:3478?transport=udp,stun:${ip}:3478`
  const iceCmd = iceServersVal ? `\ncpctl set CP_AGENT_ICE_SERVERS "${iceServersVal}"` : ''
  const devIdCmd = form.deviceId ? `\ncpctl set CP_AGENT_ID "${form.deviceId}"` : ''
  return `su\ncpctl set CP_AGENT_SIGNALING "${sig}"${iceCmd}${devIdCmd}\ncpctl restart`
})

// Copy command to clipboard
function copyCommand(text) {
  navigator.clipboard.writeText(text).then(() => {
    alert('Command copied to clipboard!')
  }).catch(err => {
    console.error('Copy failed:', err)
    alert('Failed to copy. Please select and copy manually.')
  })
}

// Format ICE Servers array to comma-separated string
function formatIceServers(servers) {
  if (!Array.isArray(servers)) return ''
  const result = []
  servers.forEach(srv => {
    if (!srv.urls || !Array.isArray(srv.urls)) return
    srv.urls.forEach(url => {
      if ((url.startsWith('turn:') || url.startsWith('turns:')) && srv.username) {
        const prefix = url.startsWith('turn:') ? 'turn:' : 'turns:'
        const hostPart = url.substring(prefix.length)
        result.push(`${prefix}${srv.username}:${srv.credential || ''}@${hostPart}`)
      } else {
        result.push(url)
      }
    })
  })
  return result.join(',')
}

// Fetch configured ICE servers from backend
async function fetchIceServers() {
  try {
    const res = await fetch('/api/ice_servers')
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        const formatted = formatIceServers(data)
        if (formatted) {
          form.iceServers = formatted
        }
      }
    }
  } catch (err) {
    console.error('Failed to get ICE Servers:', err)
  }
}

onMounted(async () => {
  // Auto-align with current host and protocol
  const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://'
  form.signalingUrl = protocol + window.location.host
  
  // Populate default ICE server address based on current host
  const host = signalingIp.value
  const ip = host.split(':')[0] || '127.0.0.1'
  form.iceServers = `turn:cloudphone_user:cloudphone_secure_password@${ip}:3478?transport=udp,stun:${ip}:3478`

  await fetchIceServers()
})
</script>

<style scoped>
.deploy-page {
  padding: 24px;
  height: 100%;
  overflow-y: auto;
}

.deploy-layout {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 24px;
  max-width: 1200px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 20px 0;
  color: var(--text-primary);
}

/* Form styles */
.form-section {
  background: var(--bg-surface, var(--bg-secondary));
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  align-self: start;
}

.form-group {
  margin-bottom: 16px;
}

.form-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.form-label {
  display: block;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.form-hint {
  font-size: 11px;
  color: var(--text-secondary);
  opacity: 0.6;
  margin-top: 4px;
  word-break: break-all;
}

.form-row .form-label {
  margin-bottom: 0;
}

.required {
  color: var(--error, #f44);
}

.form-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 13px;
  background: var(--bg-primary);
  color: var(--text-primary);
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: var(--accent);
}

/* Toggle switch */
.toggle {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 22px;
}

.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background: var(--border);
  border-radius: 22px;
  transition: 0.2s;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  height: 16px;
  width: 16px;
  left: 3px;
  bottom: 3px;
  background: white;
  border-radius: 50%;
  transition: 0.2s;
}

.toggle input:checked + .toggle-slider {
  background: var(--accent);
}

.toggle input:checked + .toggle-slider::before {
  transform: translateX(18px);
}

.deploy-btn {
  width: 100%;
  padding: 10px;
  margin-top: 8px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.deploy-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.deploy-btn:disabled {
  background: var(--bg-hover);
  color: var(--text-muted);
  cursor: not-allowed;
}

/* Manual deployment cards */
.divider {
  height: 1px;
  background: var(--border);
  margin: 20px 0;
  opacity: 0.8;
}

.manual-download-box {
  display: flex;
  flex-direction: column;
}

.sub-section-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 12px 0;
  color: var(--text-primary);
}

.download-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.download-action-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  text-decoration: none;
  color: var(--text-primary);
  font-size: 12px;
  transition: all 0.2s ease;
}

.download-action-btn:hover {
  border-color: var(--accent);
  background: rgba(59, 130, 246, 0.05);
}

.download-action-btn .btn-name {
  font-weight: 500;
}

.download-action-btn .download-icon-text {
  font-size: 11px;
  color: var(--accent);
  background: rgba(59, 130, 246, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.download-action-btn.core-library {
  border-color: rgba(16, 185, 129, 0.3); /* Border styling */
  background: rgba(16, 185, 129, 0.02);
}

.download-action-btn.core-library:hover {
  border-color: rgb(16, 185, 129);
  background: rgba(16, 185, 129, 0.08);
}

.download-action-btn.core-library .download-icon-text {
  color: rgb(16, 185, 129);
  background: rgba(16, 185, 129, 0.1);
}


/* Log container */
.log-section {
  background: var(--bg-surface, var(--bg-secondary));
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  min-height: 400px;
}

.steps {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.step {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  padding: 4px 10px;
  border-radius: 6px;
  background: var(--bg-primary);
}

.step.done {
  color: var(--success, #4caf50);
}

.step.active {
  color: var(--accent);
  background: rgba(59, 130, 246, 0.1);
}

.step.error {
  color: var(--error, #f44);
  background: rgba(244, 67, 54, 0.1);
}

.step-icon {
  font-size: 14px;
}

.progress-bar {
  height: 6px;
  background: var(--border);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 12px;
}

.progress-inner {
  height: 100%;
  background: var(--accent);
  transition: width 0.3s ease;
}

.status-line {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.status-line.success {
  color: var(--success, #4caf50);
}

.status-line.error {
  color: var(--error, #f44);
}

.log-area {
  flex: 1;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
  line-height: 1.6;
  overflow-y: auto;
  max-height: 400px;
}

.log-empty {
  color: var(--text-secondary);
  opacity: 0.5;
}

.log-line {
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-all;
}

/* Right column manual guide */
.right-column {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.manual-section {
  background: var(--bg-surface, var(--bg-secondary));
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  display: flex;
  flex-direction: column;
}

.manual-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
}

/* Two-column layout on wide screens */
@media (min-width: 1024px) {
  .manual-layout {
    grid-template-columns: 320px 1fr;
  }
}

.manual-subtitle {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin: 0 0 14px 0;
  opacity: 0.85;
}

.download-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.download-card-btn {
  display: flex;
  flex-direction: column;
  padding: 12px 14px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  text-decoration: none;
  color: var(--text-primary);
  transition: all 0.2s ease;
}

.download-card-btn:hover {
  border-color: var(--accent);
  background: rgba(59, 130, 246, 0.04);
  transform: translateY(-1px);
}

.download-card-btn .card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
  margin-bottom: 4px;
}

.download-card-btn .card-desc {
  font-size: 11px;
  color: var(--text-secondary);
  opacity: 0.7;
}

.download-card-btn.core-library-card {
  border-color: rgba(16, 185, 129, 0.3);
  background: rgba(16, 185, 129, 0.01);
}

.download-card-btn.core-library-card:hover {
  border-color: rgb(16, 185, 129);
  background: rgba(16, 185, 129, 0.06);
}

.download-card-btn.core-library-card .card-title {
  color: rgb(16, 185, 129);
}

/* ADB steps styling */
.guide-steps {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.guide-step-item {
  display: flex;
  gap: 12px;
}

.guide-step-item .step-num {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: var(--accent);
  color: white;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 2px;
}

.guide-step-item .step-content {
  flex: 1;
}

.guide-step-item .step-content p {
  margin: 0 0 8px 0;
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.5;
}

.code-block {
  margin: 0;
  padding: 10px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
  color: var(--text-primary);
  overflow-x: auto;
  line-height: 1.5;
}

.code-block.wrap {
  white-space: pre-wrap;
  word-break: break-all;
}

.code-container {
  position: relative;
}

.copy-code-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 4px 8px;
  background: var(--bg-surface, var(--bg-secondary));
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 11px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.copy-code-btn:hover {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

/* Mobile layout */
@media (max-width: 768px) {
  .deploy-layout {
    grid-template-columns: 1fr;
  }
}
.manual-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}

.manual-header .section-title {
  margin-bottom: 0;
}

.deploy-mode-tabs {
  display: flex;
  gap: 8px;
  background: rgba(0, 0, 0, 0.2);
  padding: 4px;
  border-radius: 8px;
  border: 1px solid var(--border);
}

.mode-tab-btn {
  padding: 6px 14px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mode-tab-btn:hover {
  color: var(--text-primary);
}

.mode-tab-btn.active {
  background: var(--bg-surface, rgba(88, 166, 255, 0.15));
  color: #58a6ff;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.mode-tab-btn.magisk-tab.active {
  background: rgba(168, 85, 247, 0.2);
  color: #c084fc;
}

.magisk-prereqs {
  border-color: rgba(168, 85, 247, 0.2);
  background: rgba(168, 85, 247, 0.02);
}

.qs-prereq-title.magisk-title {
  color: #c084fc;
}

.download-card-btn.gold-card {
  border-color: rgba(88, 166, 255, 0.4);
  background: rgba(88, 166, 255, 0.03);
}

.download-card-btn.gold-card:hover {
  border-color: #58a6ff;
  background: rgba(88, 166, 255, 0.08);
}

.download-card-btn.gold-card .card-title {
  color: #58a6ff;
  font-weight: 700;
}

.download-card-btn.magisk-card {
  border-color: rgba(168, 85, 247, 0.4);
  background: rgba(168, 85, 247, 0.03);
}

.download-card-btn.magisk-card:hover {
  border-color: #a855f7;
  background: rgba(168, 85, 247, 0.08);
}

.download-card-btn.magisk-card .card-title {
  color: #a855f7;
  font-weight: 700;
}

.script-box-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

/* Notice and prereq styling */
.webusb-warning {
  font-size: 12px;
  color: #ff7675;
  background: rgba(255, 118, 117, 0.08);
  border: 1px solid rgba(255, 118, 117, 0.15);
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 24px;
  line-height: 1.6;
}

.manual-prereqs {
  background: rgba(255, 255, 255, 0.015);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 14px 18px;
  margin-bottom: 24px;
}

.qs-prereq-title {
  font-size: 13px;
  font-weight: 600;
  color: #ff9f43;
  margin-bottom: 8px;
}

.qs-prereq-list {
  margin: 0;
  padding-left: 20px;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.qs-prereq-list li {
  margin-bottom: 4px;
}

.qs-prereq-list li:last-child {
  margin-bottom: 0;
}
</style>
