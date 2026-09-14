<template>
  <div class="share-page-container">
    <!-- Top status bar -->
    <header class="share-header glow-bottom">
      <div class="header-left">
        <div class="logo">
          <span class="pulse-dot"></span>
          <span class="title-text">Cloud Phone Direct Access</span>
        </div>
        <div v-if="shareInfo" class="device-info-pill">
          <span class="icon">📱</span>
          <span class="device-name">{{ shareInfo.device_name || shareInfo.device_id }}</span>
          <span v-if="shareInfo.card_code" class="card-tag">{{ shareInfo.card_code }}</span>
        </div>
      </div>

      <div class="header-center" v-if="shareInfo">
        <div class="countdown-badge" :class="{ 'warning': remainingSeconds < 300 }">
          <span class="clock-icon">⏱️</span>
          <span class="label">Remaining Validity:</span>
          <span class="time-value">{{ formatCountdown(remainingSeconds) }}</span>
        </div>
      </div>

      <div class="header-right" v-if="shareInfo">
        <span :class="['mode-tag', shareInfo.access_mode]">
          {{ shareInfo.access_mode === 'full' ? '⚡ Full Control' : '👁️ View Only' }}
        </span>
        <button class="btn-refresh" @click="reloadPage" title="Refresh & Reconnect">🔄 Reconnect</button>
      </div>
    </header>

    <!-- Main display area -->
    <main class="share-main">
      <!-- 1. Loading state -->
      <div v-if="loading" class="state-container">
        <div class="loading-spinner"></div>
        <p class="loading-text">Validating share credentials and connecting to signaling server...</p>
      </div>

      <!-- 2. Password required -->
      <div v-else-if="needPassword" class="state-container">
        <div class="pwd-icon">🔒</div>
        <h2>Access Password Required</h2>
        <p class="pwd-desc">Please enter the access PIN configured for this share</p>
        <input
          v-model="password"
          type="password"
          class="pwd-input"
          placeholder="Access Password"
          @keyup.enter="submitPassword"
        />
        <div v-if="pwdError" class="pwd-error">⚠️ {{ pwdError }}</div>
        <button class="pwd-submit" @click="submitPassword">Confirm & Connect</button>
      </div>

      <!-- 3. Expired / invalid state -->
      <div v-else-if="error" class="state-container error-state">
        <div class="error-icon">🚫</div>
        <h2>Share Link or Card Key Expired</h2>
        <p class="error-desc">{{ error }}</p>
        <div class="error-actions">
          <router-link to="/" class="btn-home">Back to Home</router-link>
          <button class="btn-card-reconnect" @click="showCardModal = true">Connect with Another Card Key</button>
        </div>
      </div>

      <!-- 4. Video rendering area -->
      <div v-else-if="shareInfo" class="console-wrapper">
        <ShareVideo
          :key="shareInfo.token"
          :deviceId="shareInfo.device_id"
          :shareToken="shareInfo.token"
          :sharePassword="password"
          :accessMode="shareInfo.access_mode"
          :guestSettings="shareInfo.guest_settings"
          :forbidBitrate="!!shareInfo.forbid_bitrate"
          :forbidFps="!!shareInfo.forbid_fps"
          :forbidResolution="!!shareInfo.forbid_resolution"
          :forbidAudio="!!shareInfo.forbid_audio"
          :cardCode="shareInfo.card_code"
          :remainingSeconds="remainingSeconds"
        />

        <!-- Read-only mode notification overlay -->
        <div v-if="shareInfo.access_mode === 'view_only'" class="view-only-overlay">
          <div class="view-only-banner">
            <span class="eye-icon">👁️</span>
            <span>Currently in "View-Only / Read-Only Mode". Touch and keyboard inputs are disabled.</span>
          </div>
        </div>
      </div>
    </main>

    <!-- Modals -->
    <CardConnectModal :visible="showCardModal" @close="showCardModal = false" />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import ShareVideo from '@/components/ShareVideo.vue'
import CardConnectModal from '@/components/CardConnectModal.vue'

const route = useRoute()
const loading = ref(true)
const error = ref('')
const shareInfo = ref(null)
const remainingSeconds = ref(0)
const showCardModal = ref(false)
const password = ref('')
const needPassword = ref(false)
const pwdError = ref('')
let timer = null

function reloadPage() {
  window.location.reload()
}

function formatCountdown(sec) {
  if (sec < 0) return '♾️ Never Expires'
  if (sec === 0) return '00:00:00 (Expired)'
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600).toString().padStart(2, '0')
  const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0')
  const s = Math.floor(sec % 60).toString().padStart(2, '0')
  // Prefix days when exceeding 24h to avoid stacked hours
  return d > 0 ? `${d}d ${h}:${m}:${s}` : `${h}:${m}:${s}`
}

function startCountdown(seconds) {
  if (timer) clearInterval(timer)
  timer = null
  if (seconds > 0) {
    timer = setInterval(() => {
      if (remainingSeconds.value > 0) {
        remainingSeconds.value--
      } else {
        clearInterval(timer)
        timer = null
        error.value = 'Share link has expired.'
      }
    }, 1000)
  }
}

async function verifyToken() {
  const tokenStr = route.query.token || route.query.stoken || ''
  if (!tokenStr) {
    loading.value = false
    error.value = 'No valid token or card code provided.'
    return
  }

  try {
    let url = `/api/share/info?token=${encodeURIComponent(tokenStr)}`
    if (password.value) {
      url += `&password=${encodeURIComponent(password.value)}`
    }
    const res = await fetch(url)
    if (!res.ok) {
      loading.value = false
      error.value = 'Share link does not exist or has expired/been revoked.'
      return
    }

    const json = await res.json()
    if (json.code === 401) {
      // Password required or incorrect: switch to password input state
      loading.value = false
      needPassword.value = true
      if (password.value) {
        pwdError.value = json.msg || 'Incorrect password, please try again'
        password.value = ''
      }
      return
    }
    if (json.code === 0 && json.data) {
      needPassword.value = false
      pwdError.value = ''
      shareInfo.value = json.data
      remainingSeconds.value = json.data.remaining_seconds
      startCountdown(remainingSeconds.value)
    } else {
      error.value = json.msg || 'Unable to parse share information'
    }
  } catch (err) {
    error.value = 'Network connection failed: ' + err.message
  } finally {
    loading.value = false
  }
}

function submitPassword() {
  if (!password.value) return
  pwdError.value = ''
  loading.value = true
  verifyToken()
}

onMounted(() => {
  // Carry validated password in history.state after card redemption to avoid re-prompting
  password.value = (window.history.state && window.history.state.sharePwd) || ''
  verifyToken()
})

// Re-validate when token changes under same route
watch(() => route.query.token, (val, old) => {
  if (val && val !== old) {
    if (timer) { clearInterval(timer); timer = null }
    loading.value = true
    error.value = ''
    shareInfo.value = null
    needPassword.value = false
    pwdError.value = ''
    password.value = (window.history.state && window.history.state.sharePwd) || ''
    verifyToken()
  }
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.share-page-container {
  width: 100vw;
  height: 100vh;
  background: #0b0f19;
  display: flex;
  flex-direction: column;
  color: #f8fafc;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  overflow: hidden;
}

.share-header {
  height: 56px;
  background: #111827;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding: 0 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 100;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pulse-dot {
  width: 10px;
  height: 10px;
  background: #10b981;
  border-radius: 50%;
  box-shadow: 0 0 10px #10b981;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
}

.title-text {
  font-weight: 700;
  font-size: 1.05rem;
  background: linear-gradient(135deg, #38bdf8, #818cf8);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.device-info-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #1e293b;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.85rem;
}

.card-tag {
  background: rgba(56, 189, 248, 0.2);
  color: #38bdf8;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-weight: bold;
}

.header-center {
  display: flex;
  align-items: center;
}

.countdown-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(56, 189, 248, 0.3);
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 0.88rem;
}

.countdown-badge.warning {
  border-color: #f43f5e;
  background: rgba(244, 63, 94, 0.1);
  color: #f43f5e;
}

.time-value {
  font-family: monospace;
  font-weight: bold;
  color: #38bdf8;
  font-size: 1rem;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mode-tag {
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.82rem;
  font-weight: 600;
}

.mode-tag.full {
  background: rgba(99, 102, 241, 0.2);
  color: #818cf8;
}

.mode-tag.view_only {
  background: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
}

.btn-refresh {
  background: #334155;
  border: none;
  color: #f8fafc;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.82rem;
  transition: background 0.2s;
}

.btn-refresh:hover {
  background: #0284c7;
}

.share-main {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.state-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
}

.pwd-icon {
  font-size: 3rem;
  margin-bottom: 12px;
}

.pwd-desc {
  margin: 8px 0 20px;
  font-size: 0.9rem;
}

.pwd-input {
  width: 260px;
  padding: 12px 14px;
  background: #0f172a;
  border: 1px solid #38bdf8;
  border-radius: 8px;
  color: #f8fafc;
  font-size: 1rem;
  outline: none;
  text-align: center;
  letter-spacing: 1px;
}

.pwd-error {
  margin-top: 12px;
  color: #f43f5e;
  font-size: 0.85rem;
}

.pwd-submit {
  margin-top: 18px;
  padding: 10px 28px;
  background: linear-gradient(135deg, #0284c7, #6366f1);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-weight: 600;
  font-size: 0.92rem;
  cursor: pointer;
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid rgba(56, 189, 248, 0.1);
  border-top-color: #38bdf8;
  border-radius: 50%;
  animation: spin 1s infinite linear;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-state .error-icon {
  font-size: 3.5rem;
  margin-bottom: 16px;
}

.error-state h2 {
  color: #f43f5e;
  margin: 0 0 8px 0;
}

.error-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.btn-home, .btn-card-reconnect {
  padding: 10px 20px;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  border: none;
}

.btn-home {
  background: #334155;
  color: #fff;
}

.btn-card-reconnect {
  background: linear-gradient(135deg, #0284c7, #6366f1);
  color: #fff;
}

.console-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
}

.view-only-overlay {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: none;
  z-index: 50;
}

.view-only-banner {
  background: rgba(245, 158, 11, 0.85);
  backdrop-filter: blur(4px);
  color: #000;
  padding: 6px 16px;
  border-radius: 20px;
  font-weight: bold;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
}

/* Mobile top bar: wrap and compact text when space is constrained */
@media (max-width: 768px) {
  .share-header {
    height: auto;
    min-height: 48px;
    padding: 6px 10px;
    flex-wrap: wrap;
    row-gap: 6px;
    column-gap: 8px;
  }

  .header-left {
    gap: 8px;
    min-width: 0;
    flex: 1 1 auto;
  }

  .title-text {
    display: none;
  }

  .device-info-pill {
    font-size: 0.75rem;
    padding: 3px 8px;
    max-width: 45vw;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .header-center {
    order: 3;
    flex-basis: 100%;
    display: flex;
    justify-content: flex-start;
  }

  .countdown-badge {
    font-size: 0.75rem;
    padding: 4px 8px;
    gap: 4px;
  }

  .countdown-badge .label {
    display: none;
  }

  .time-value {
    font-size: 0.82rem;
  }

  .header-right {
    gap: 8px;
    flex-shrink: 0;
  }

  .mode-tag {
    font-size: 0.72rem;
    padding: 3px 6px;
  }

  .btn-refresh {
    padding: 4px 8px;
    font-size: 0.75rem;
  }
}
</style>
