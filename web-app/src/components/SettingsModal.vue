<template>
  <Teleport to="body">
    <div class="settings-modal">
      <div class="modal-content animate-fade-in">
        <div class="modal-header">
          <div class="header-title">
            <span class="header-icon">⚙️</span>
            <h3>Connection Settings</h3>
          </div>
          <button class="close-btn" @click="$emit('close')">×</button>
        </div>

        <!-- Tab navigation -->
        <div class="modal-tabs">
          <button :class="['tab-btn', { active: activeTab === 'video' }]" @click="activeTab = 'video'">
            <svg class="tab-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
            <span class="tab-label">Video</span>
          </button>
          <button v-if="showPreviewTab" :class="['tab-btn', { active: activeTab === 'preview' }]" @click="activeTab = 'preview'">
            <svg class="tab-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect></svg>
            <span class="tab-label">Preview</span>
          </button>
          <button :class="['tab-btn', { active: activeTab === 'audio' }]" @click="activeTab = 'audio'">
            <svg class="tab-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
            <span class="tab-label">Audio</span>
          </button>
          <button :class="['tab-btn', { active: activeTab === 'advanced' }]" @click="activeTab = 'advanced'">
            <svg class="tab-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            <span class="tab-label">Advanced</span>
          </button>
        </div>

        <div class="modal-body custom-scrollbar">
          <!-- 🎥 Video panel -->
          <div v-if="activeTab === 'video'" class="tab-pane">
            <div class="form-group">
              <label>Max Resolution (Max Size) <span v-if="isLocked('size')" class="lock-tag">🔒 Locked by Sharer</span></label>
              <input type="number" v-model.number="localSettings.size" min="0" step="100" :disabled="isLocked('size')" />
              <small class="hint">0 for unlimited. e.g. 1080 limits max dimension to 1080px</small>
            </div>

            <div class="form-group">
              <label>Frame Rate (Max FPS) <span v-if="isLocked('fps')" class="lock-tag">🔒 Locked by Sharer</span></label>
              <input type="number" v-model.number="localSettings.fps" min="0" max="120" :disabled="isLocked('fps')" />
              <small class="hint">0 for unlimited. 30 or 60 FPS recommended</small>
            </div>

            <div class="form-group form-group-row">
              <div class="group-info">
                <label>Enable BWE Congestion Control (WebRTC) <span v-if="isLocked('bitrate')" class="lock-tag">🔒 Locked by Sharer</span></label>
                <small class="hint">Dynamically assesses bandwidth and adapts bitrate (WebRTC only)</small>
              </div>
              <div class="toggle-switch">
                <input type="checkbox" id="bwe-toggle" v-model="localSettings.bwe" :disabled="isLocked('bitrate')" />
                <label for="bwe-toggle"></label>
              </div>
            </div>

            <!-- BWE enabled: bitrate thresholds -->
            <div v-if="localSettings.bwe" class="sub-section">
              <div class="form-group">
                <label>WebRTC Min Bitrate (Mbps)</label>
                <input type="number" v-model.number="localSettings.minBitrate" min="1" step="1" :disabled="isLocked('bitrate')" />
                <small class="hint">Quality floor under poor network, default: 8 Mbps</small>
              </div>
              <div class="form-group">
                <label>WebRTC Max Bitrate (Mbps)</label>
                <input type="number" v-model.number="localSettings.maxBitrate" min="1" step="1" :disabled="isLocked('bitrate')" />
                <small class="hint">Quality ceiling under high bandwidth, default: 20 Mbps</small>
              </div>
            </div>

            <!-- Constant Bitrate -->
            <div class="form-group">
              <label>Constant Bitrate (Bitrate - Mbps) <span v-if="isLocked('bitrate')" class="lock-tag">🔒 Locked by Sharer</span></label>
              <input type="number" v-model.number="localSettings.bitrate" min="0.1" step="0.1" :disabled="isLocked('bitrate')" />
              <small class="hint">⚡ Used for <strong>WebSocket Streaming Mode</strong> and WebRTC when BWE is disabled (default: 4 Mbps)</small>
            </div>

            <div class="form-group">
              <label>Video Render Engine</label>
              <select v-model="localSettings.renderEngine" class="select-input">
                <option value="video">📺 Standard HTML5 (&lt;video&gt; / Best compatibility / PiP)</option>
                <option value="webcodecs">🚀 WebCodecs Ultra Low Latency (Experimental / Direct VSync / Minimal Lag)</option>
              </select>
              <small class="hint">Standard mode has widest compatibility and PiP; WebCodecs minimizes latency via direct canvas render</small>
            </div>

            <div class="form-group">
              <label>Video Codec Options (video_codec_options)</label>
              <input type="text" v-model="localSettings.videoCodecOptions" placeholder="e.g. intra-refresh-period=30,i-frame-interval=2" />
              <small class="hint">Parameters for scrcpy video encoder. Leave empty for Agent defaults.</small>
            </div>
          </div>

          <!-- 📊 Dashboard preview panel -->
          <div v-if="activeTab === 'preview' && showPreviewTab" class="tab-pane">
            <div class="form-group-divider">Real-Time High Frequency Preview</div>

            <div class="form-group">
              <label>Preview Max Resolution (Max Size)</label>
              <input type="number" v-model.number="localSettings.previewSize" min="0" step="10" />
              <small class="hint">Default 360. Max edge length for thumbnail stream, 240-480px recommended</small>
            </div>

            <div class="form-group">
              <label>Preview Max Frame Rate (Max FPS)</label>
              <input type="number" v-model.number="localSettings.previewFps" min="1" max="60" />
              <small class="hint">Default 10. Recommended 5-15 FPS to reduce VM CPU overhead</small>
            </div>

            <div class="form-group">
              <label>Preview Decoder Engine</label>
              <select v-model="localSettings.previewDecoder" class="select-input">
                <option value="wasm">WASM Software Decoding (Best Compatibility)</option>
                <option value="webcodecs">WebCodecs Hardware Decoding (Lower CPU / Energy)</option>
              </select>
              <small class="hint">WebCodecs supports hardware acceleration; WASM provides universal compatibility</small>
            </div>

            <div class="form-group">
              <label>Preview Bitrate (Mbps)</label>
              <input type="number" v-model.number="localSettings.previewBitrate" min="0.1" step="0.1" />
              <small class="hint">Bandwidth for dashboard card background stream (default 1 Mbps)</small>
            </div>

            <div class="form-group-divider">Standby Thumbnail</div>

            <div class="form-group">
              <label>Thumbnail Interval (Seconds)</label>
              <input type="number" v-model.number="localSettings.snapshotInterval" min="-1" step="1" />
              <small class="hint">Reporting interval for static snapshots when WebRTC is not active. Set to -1 to disable.</small>
            </div>
          </div>

          <!-- 🔊 Audio panel -->
          <div v-if="activeTab === 'audio'" class="tab-pane">
            <div class="form-group form-group-row">
              <div class="group-info">
                <label>Enable Audio (Opus) <span v-if="isLocked('audio')" class="lock-tag">🔒 Locked by Sharer</span></label>
                <small class="hint">Stream device audio (defaults to output)</small>
              </div>
              <div class="toggle-switch">
                <input type="checkbox" id="audio-toggle" v-model="localSettings.audio" :disabled="isLocked('audio')" />
                <label for="audio-toggle"></label>
              </div>
            </div>

            <div v-if="localSettings.audio" class="sub-section animate-slide-down">
              <div class="form-group">
                <label>Audio Source</label>
                <select v-model="localSettings.audioSource" class="select-input" :disabled="isLocked('audio')">
                  <option value="output">output (Capture speaker output, mute device speaker)</option>
                  <option value="playback">playback (Keep device sound, Android 13+ only)</option>
                  <option value="mic">mic (Microphone input - recommended for security monitoring)</option>
                </select>
                <small class="hint" v-if="localSettings.audioSource === 'mic'">Captures device microphone audio directly, ideal for surveillance and monitoring</small>
                <small class="hint" v-else-if="localSettings.audioSource === 'playback'">Preserves local speaker audio, but only captures apps that allow internal recording</small>
                <small class="hint" v-else>Captures complete system audio, muting the physical speaker</small>
              </div>

              <div class="form-group form-group-row" v-if="localSettings.audioSource === 'playback'">
                <div class="group-info">
                  <label>Keep Physical Device Audio</label>
                  <small class="hint">Only effective in playback mode if supported by OS</small>
                </div>
                <div class="toggle-switch">
                  <input type="checkbox" id="audio-dup-toggle" v-model="localSettings.audioDup" :disabled="isLocked('audio')" />
                  <label for="audio-dup-toggle"></label>
                </div>
              </div>

              <div class="form-group">
                <label>Volume Gain</label>
                <input type="number" v-model.number="localSettings.audioGain" min="0.5" max="3" step="0.25" :disabled="isLocked('audio')" />
                <small class="hint">Default 1.0. Scale volume from 0.5x to 3.0x</small>
              </div>

              <div class="form-group form-group-row">
                <div class="group-info">
                  <label>Mute by Default</label>
                  <small class="hint">Mutes browser tab audio output without disabling cloud audio encoding</small>
                </div>
                <div class="toggle-switch">
                  <input type="checkbox" id="page-audio-muted-toggle" v-model="localSettings.pageAudioMuted" />
                  <label for="page-audio-muted-toggle"></label>
                </div>
              </div>
            </div>
          </div>

          <!-- ⚙️ Advanced panel -->
          <div v-if="activeTab === 'advanced'" class="tab-pane">
            <div class="form-group">
              <label>Connection Channel Preference</label>
              <select v-model="localSettings.connectionPath" class="select-input">
                <option value="auto">Auto (Direct first, fallback to Relay)</option>
                <option value="direct">Force Direct (P2P Host only, no Relay)</option>
                <option value="relay">Force Relay (TURN only, masks local IP)</option>
              </select>
              <small class="hint">Controls WebRTC link routing (direct P2P or TURN relay)</small>
            </div>

            <div class="form-group">
              <label>IP Protocol Preference</label>
              <select v-model="localSettings.ipPreference" class="select-input">
                <option value="auto">Auto (Dual-stack adaptive)</option>
                <option value="ipv4">Force IPv4</option>
                <option value="ipv6">Force IPv6</option>
              </select>
              <small class="hint">Controls filtering of ICE candidate IP versions</small>
            </div>

            <div class="form-group form-group-row">
              <div class="group-info">
                <label>Turn Screen Off on Connect</label>
                <small class="hint">Turns off physical device display backlight while streaming (privacy & battery saving)</small>
              </div>
              <div class="toggle-switch">
                <input type="checkbox" id="poweroff-toggle" v-model="localSettings.powerOff" />
                <label for="poweroff-toggle"></label>
              </div>
            </div>

            <div class="form-group form-group-row">
              <div class="group-info">
                <label>Stay Awake</label>
                <small class="hint">Prevents device from sleeping during connection and preview</small>
              </div>
              <div class="toggle-switch">
                <input type="checkbox" id="stayawake-toggle" v-model="localSettings.stayAwake" />
                <label for="stayawake-toggle"></label>
              </div>
            </div>

            <div class="form-group form-group-row">
              <div class="group-info">
                <label>Enable Agent Debug Logs</label>
                <small class="hint">Print verbose scrcpy-server and video stream logs in terminal</small>
              </div>
              <div class="toggle-switch">
                <input type="checkbox" id="debug-toggle" v-model="localSettings.debug" />
                <label for="debug-toggle"></label>
              </div>
            </div>

            <div class="form-group form-group-row">
              <div class="group-info">
                <label>Show Connection Status Overlay</label>
                <small class="hint">Display connection quality metrics and overlay stats on video</small>
              </div>
              <div class="toggle-switch">
                <input type="checkbox" id="show-stats-toggle" v-model="localSettings.showStats" />
                <label for="show-stats-toggle"></label>
              </div>
            </div>

            <div class="form-group form-group-row">
              <div class="group-info">
                <label>Enable Camera Injection</label>
                <small class="hint" v-if="cameraSupport">Streams browser webcam video into cloud phone camera</small>
                <small class="hint" v-else style="color: #f85149;">⚠️ Camera HAL not deployed on this VM, camera injection unsupported</small>
              </div>
              <div class="toggle-switch">
                <input type="checkbox" id="camera-toggle" v-model="localSettings.camera" :disabled="!cameraSupport" />
                <label for="camera-toggle"></label>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-danger" v-if="isCustom" @click="resetToGlobal">Restore Defaults</button>
          <div style="flex: 1"></div>
          <button class="btn btn-secondary" @click="$emit('close')">Cancel</button>
          <button class="btn btn-primary" @click="saveAndReconnect">
            {{ isGlobal ? 'Save Global Settings' : (isConnected ? 'Save & Reconnect' : 'Save & Connect') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  settings: {
    type: Object,
    required: true
  },
  isConnected: {
    type: Boolean,
    default: false
  },
  isGlobal: {
    type: Boolean,
    default: false
  },
  isCustom: {
    type: Boolean,
    default: false
  },
  cameraSupport: {
    type: Boolean,
    default: true
  },
  // Locked settings partitions
  // For share guest view: locked partitions grayed out
  lockedSections: {
    type: Array,
    default: () => []
  },
  // Whether to show Preview tab
  showPreviewTab: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['close', 'save', 'reset'])

const localSettings = ref({ ...props.settings })
const activeTab = ref('video')

function isLocked(section) {
  return props.lockedSections.includes(section)
}

// Default audioSource to output when audio enabled
watch(() => localSettings.value.audio, (newVal) => {
  if (newVal) {
    if (!localSettings.value.audioSource) {
      localSettings.value.audioSource = 'output'
    }
  }
})

// Set default camera lens when switching to monitor mode
watch(() => localSettings.value.videoSource, (newSource) => {
  if (newSource === 'camera') {
    if (!localSettings.value.cameraFacing) {
      localSettings.value.cameraFacing = 'back'
    }
  }
})

function saveAndReconnect() {
  emit('save', { ...localSettings.value })
  emit('close')
}

function resetToGlobal() {
  emit('reset')
  emit('close')
}
</script>

<style scoped>
.settings-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(10, 12, 16, 0.65);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
  backdrop-filter: blur(12px);
  padding: 16px;
  box-sizing: border-box;
}

.modal-content {
  background: #161b22;
  border-radius: 16px;
  width: 100%;
  max-width: 440px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.5);
  transform: translateY(0);
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.animate-fade-in {
  animation: modalEnter 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes modalEnter {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.01);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-icon {
  font-size: 18px;
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #f0f6fc;
}

.close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: #8b949e;
  font-size: 24px;
  border-radius: 8px;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #f0f6fc;
}

/* Tab Navigation Bar */
.modal-tabs {
  display: flex;
  background: rgba(0, 0, 0, 0.15);
  padding: 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  gap: 4px;
}

.tab-btn {
  flex: 1;
  padding: 8px 4px;
  background: transparent;
  border: none;
  color: #8b949e;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.tab-icon-svg {
  width: 18px;
  height: 18px;
}

.tab-label {
  font-size: 11px;
  font-weight: 500;
}

.tab-btn:hover {
  color: #f0f6fc;
  background: rgba(255, 255, 255, 0.02);
}

.tab-btn.active {
  color: #58a6ff;
  background: rgba(88, 166, 255, 0.08);
  box-shadow: inset 0 0 0 1px rgba(88, 166, 255, 0.15);
}

/* Modal Body */
.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  background: #0d1117;
  max-height: 50vh;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.24);
}

.tab-pane {
  display: flex;
  flex-direction: column;
  gap: 12px;
  animation: paneEnter 0.2s ease forwards;
}

.form-group-divider {
  font-size: 11px;
  font-weight: 700;
  color: #58a6ff;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 16px 0 4px;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(88, 166, 255, 0.15);
}

@keyframes paneEnter {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.sub-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  border-left: 2px dashed rgba(88, 166, 255, 0.2);
  padding-left: 12px;
  margin-top: -4px;
  margin-bottom: 4px;
}

.animate-slide-down {
  animation: slideDown 0.2s ease forwards;
}

@keyframes slideDown {
  from { height: 0; opacity: 0; overflow: hidden; }
  to { height: auto; opacity: 1; }
}

/* Form Elements */
.form-group {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  padding: 12px 14px;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: all 0.2s ease;
}

.form-group:focus-within {
  border-color: rgba(88, 166, 255, 0.25);
  background: rgba(255, 255, 255, 0.03);
}

.form-group-row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.group-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.form-group label {
  font-size: 13px;
  font-weight: 500;
  color: #c9d1d9;
}

.form-group-row label {
  font-size: 13px;
  font-weight: 600;
}

.hint {
  font-size: 11px;
  color: #8b949e;
  line-height: 1.4;
}

/* Locked Items */
.lock-tag {
  font-size: 11px;
  font-weight: 400;
  color: #fbbf24;
  margin-left: 6px;
}

.form-group input:disabled,
.form-group select:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.toggle-switch input:disabled + label {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Inputs & Selects */
.form-group input[type="number"], 
.form-group input[type="text"], 
.form-group select.select-input {
  background: #21262d;
  border: 1px solid #30363d;
  padding: 8px 12px;
  border-radius: 8px;
  color: #c9d1d9;
  font-size: 13px;
  outline: none;
  transition: all 0.2s ease;
  width: 100%;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group select:focus {
  border-color: #58a6ff;
  box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.15);
}

/* Toggle Switches */
.toggle-switch {
  display: flex;
  align-items: center;
}

.toggle-switch input[type="checkbox"] {
  display: none;
}

.toggle-switch label {
  cursor: pointer;
  width: 44px;
  height: 22px;
  background: #30363d;
  border-radius: 11px;
  position: relative;
  transition: background-color 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.toggle-switch label::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background: #f0f6fc;
  border-radius: 50%;
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.toggle-switch input[type="checkbox"]:checked + label {
  background: #238636;
}

.toggle-switch input[type="checkbox"]:checked + label::after {
  transform: translateX(22px);
  background: #ffffff;
}

/* Footer Buttons */
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  background: rgba(0, 0, 0, 0.1);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.btn {
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  border: none;
}

.btn-secondary {
  background: transparent;
  color: #c9d1d9;
  border: 1px solid #30363d;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: #8b949e;
}

.btn-primary {
  background: #1f6feb;
  color: #ffffff;
}

.btn-primary:hover {
  background: #388bfd;
  box-shadow: 0 0 0 3px rgba(56, 139, 253, 0.25);
}

.btn-danger {
  background: transparent;
  color: #f85149;
  border: 1px solid rgba(248, 81, 73, 0.3);
}

.btn-danger:hover {
  background: rgba(248, 81, 73, 0.1);
  border-color: #f85149;
}

/* Responsive mobile */
@media (max-width: 480px) {
  .settings-modal {
    padding: 0;
    align-items: flex-end; /* Bottom sheet on mobile */
  }

  .modal-content {
    max-width: 100%;
    border-radius: 20px 20px 0 0; /* No bottom border-radius */
    max-height: 85vh;
    animation: mobileSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  @keyframes mobileSlideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }

  .modal-tabs {
    padding: 6px;
  }

  .tab-btn {
    padding: 6px 2px;
  }

  .tab-label {
    font-size: 10px;
  }

  .modal-body {
    padding: 12px 16px;
    max-height: 48vh; /* Prevent virtual keyboard overflow */
  }

  .form-group {
    padding: 10px 12px;
  }

  .modal-footer {
    padding: 12px 16px;
    flex-wrap: wrap; /* Wrap on small screens */
    gap: 8px;
  }

  .modal-footer .btn {
    flex: 1; /* Equal button widths */
    min-width: 80px;
    text-align: center;
  }
}
</style>
