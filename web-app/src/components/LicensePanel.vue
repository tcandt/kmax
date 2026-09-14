<template>
  <transition name="fade">
    <div v-if="visible" class="license-panel-overlay" @click="$emit('close')">
      <div class="license-panel-card" @click.stop>
        <button class="panel-close-btn" @click="$emit('close')">✕</button>
        <div class="panel-title">License Management</div>

        <!-- Current plan badge -->
        <div class="plan-badge" :class="planBadgeClass">{{ planBadgeText }}</div>

        <div class="panel-body">
          <!-- Enterprise notice banner -->
          <div v-if="isEnterprise" class="enterprise-unlocked-card">
            <div class="enterprise-badge-title">⭐ Full Source Enterprise Edition</div>
            <div class="enterprise-badge-desc">
              All commercial device limitations have been permanently unlocked. Administrators have unlimited device access and can freely assign quotas to other users in User Management.
            </div>
          </div>

          <!-- Usage progress bar -->
          <div class="usage-row">
            <span class="status-label">Device Usage</span>
            <span class="status-value highlight">{{ currentDevices }} {{ isEnterprise ? 'units (Unlimited)' : '/ ' + deviceStore.licenseMaxDevices + ' units' }}</span>
          </div>
          <div class="usage-bar-track">
            <div class="usage-bar-fill" :class="usageBarClass" :style="{ width: isEnterprise ? '100%' : (usagePercent + '%') }"></div>
          </div>

          <!-- License status details -->
          <div class="license-status-display">
            <div class="status-item" v-if="deviceStore.licenseActivated">
              <span class="status-label">Remaining Validity:</span>
              <span class="status-value highlight">{{ isEnterprise ? 'Permanent' : (deviceStore.licenseDaysRemaining + ' days') }}</span>
            </div>
            <div class="status-item">
              <span class="status-label">Max Device Limit:</span>
              <span class="status-value highlight">{{ isEnterprise ? 'Unlimited' : (deviceStore.licenseMaxDevices + ' units') }}</span>
            </div>
            <div class="status-item" v-if="deviceStore.licenseExpiresAt">
              <span class="status-label">Expiration Date:</span>
              <span class="status-value">{{ isEnterprise ? 'Permanent / Unlimited' : deviceStore.licenseExpiresAt }}</span>
            </div>
          </div>

          <!-- Limited promo info (only when not enterprise and not activated) -->
          <div v-if="!isEnterprise && !deviceStore.licenseActivated && deviceStore.licensePromo" class="promo-tip">
            Limited Promo: {{ deviceStore.licenseMaxDevices }} units before {{ deviceStore.licenseExpiresAt }}, 
            reverting to {{ deviceStore.licensePostPromoMaxDevices }} units after expiration
          </div>

          <!-- Machine code + copy button -->
          <div class="license-info-row">
            <span class="info-label">Server License ID:</span>
            <div class="machine-id-container">
              <code>{{ deviceStore.globalMachineID || 'ENTERPRISE-UNLIMITED' }}</code>
              <button class="copy-btn" @click="copyMachineID" :disabled="!deviceStore.globalMachineID">
                {{ copySuccess ? 'Copied' : 'Copy' }}
              </button>
            </div>
          </div>

          <!-- Activation code input (shown for custom license update if needed) -->
          <div class="license-input-group" v-if="!isEnterprise">
            <label for="license-panel-input">License Activation Key:</label>
            <textarea
              id="license-panel-input"
              v-model="activationKey"
              placeholder="Paste your activation key here..."
              rows="3"
            ></textarea>
            <button class="activate-btn" :disabled="isActivating || !activationKey.trim()" @click="submitActivation">
              {{ isActivating ? 'Activating...' : 'Submit Activation' }}
            </button>
          </div>
          <div v-if="activationError" class="activation-error-msg">
            ❌ {{ activationError }}
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useDeviceStore } from '@/stores/devices'

const props = defineProps({
  visible: { type: Boolean, default: false }
})
defineEmits(['close'])

const deviceStore = useDeviceStore()

const isEnterprise = computed(() => {
  return deviceStore.licenseMaxDevices >= 99999 || 
         deviceStore.licenseCustomer === 'Enterprise Unlimited' || 
         deviceStore.globalMachineID === 'ENTERPRISE-UNLIMITED'
})

const activationKey = ref('')
const isActivating = ref(false)
const activationError = ref(null)
const copySuccess = ref(false)

// Refresh license status on panel open
watch(() => props.visible, (val) => {
  if (val) {
    deviceStore.fetchLicenseStatus()
    activationError.value = null
  }
})

// Current plan badge text and style
const planBadgeText = computed(() => {
  if (isEnterprise.value) return 'Enterprise Edition · Unlimited'
  if (deviceStore.licenseActivated) return `Licensed · ${deviceStore.licenseCustomer || 'Official'}`
  if (deviceStore.licensePromo) return 'Free Edition · Limited Promo'
  return 'Free Edition'
})
const planBadgeClass = computed(() => {
  if (isEnterprise.value) return 'badge-enterprise'
  if (deviceStore.licenseActivated) return 'badge-activated'
  if (deviceStore.licensePromo) return 'badge-promo'
  return 'badge-free'
})

// Usage: prioritize online device count, consistent with list badge
const currentDevices = computed(() => deviceStore.onlineDevices.length || deviceStore.licenseCurrentDevices)
const usagePercent = computed(() => {
  const max = deviceStore.licenseMaxDevices || 1
  return Math.min(100, Math.round((currentDevices.value / max) * 100))
})
const usageBarClass = computed(() => {
  if (isEnterprise.value) return 'bar-enterprise'
  if (usagePercent.value >= 100) return 'bar-danger'
  if (usagePercent.value >= 80) return 'bar-warn'
  return ''
})

function copyMachineID() {
  const id = deviceStore.globalMachineID || 'ENTERPRISE-UNLIMITED'
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(id)
      .then(() => {
        copySuccess.value = true
        setTimeout(() => { copySuccess.value = false }, 2000)
      })
      .catch(err => {
        console.error('Failed to copy machine ID:', err)
      })
  }
}

async function submitActivation() {
  if (!activationKey.value.trim()) return
  isActivating.value = true
  activationError.value = null

  const res = await deviceStore.activateLicense(activationKey.value.trim())
  isActivating.value = false
  if (res.success) {
    activationKey.value = ''
    await deviceStore.fetchLicenseStatus()
    alert('System activation successful! License reloaded and applied immediately.')
  } else {
    activationError.value = res.error
  }
}
</script>

<style scoped>
.license-panel-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.license-panel-card {
  background: #161b22;
  border: 1px solid var(--border);
  border-radius: 12px;
  width: min(460px, 92vw);
  max-height: 90vh;
  padding: 24px;
  position: relative;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.panel-close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  background: transparent;
  border: none;
  color: #8b949e;
  font-size: 16px;
  cursor: pointer;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.panel-close-btn:hover {
  color: #c9d1d9;
  background: rgba(255, 255, 255, 0.08);
}

.panel-title {
  font-size: 16px;
  font-weight: 600;
  color: #e6edf3;
  margin-bottom: 14px;
  flex-shrink: 0;
}

.plan-badge {
  display: inline-flex;
  align-self: flex-start;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 999px;
  margin-bottom: 14px;
  border: 1px solid transparent;
}

.plan-badge.badge-enterprise {
  color: #3fb950;
  background: rgba(63, 185, 80, 0.15);
  border-color: rgba(63, 185, 80, 0.45);
  box-shadow: 0 0 10px rgba(63, 185, 80, 0.15);
}

.plan-badge.badge-activated {
  color: #3fb950;
  background: rgba(63, 185, 80, 0.1);
  border-color: rgba(63, 185, 80, 0.35);
}

.plan-badge.badge-promo {
  color: #d29922;
  background: rgba(210, 153, 34, 0.1);
  border-color: rgba(210, 153, 34, 0.4);
}

.plan-badge.badge-free {
  color: #8b949e;
  background: rgba(139, 148, 158, 0.1);
  border-color: #30363d;
}

.enterprise-unlocked-card {
  background: linear-gradient(135deg, rgba(63, 185, 80, 0.1) 0%, rgba(35, 134, 54, 0.05) 100%);
  border: 1px solid rgba(63, 185, 80, 0.3);
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 14px;
}

.enterprise-badge-title {
  font-size: 13px;
  font-weight: 600;
  color: #3fb950;
  margin-bottom: 4px;
}

.enterprise-badge-desc {
  font-size: 12px;
  line-height: 1.4;
  color: #8b949e;
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding-right: 4px;
}

.panel-body::-webkit-scrollbar {
  width: 4px;
}
.panel-body::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.usage-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  margin-bottom: 6px;
}

.usage-bar-track {
  width: 100%;
  height: 8px;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 14px;
}

.usage-bar-fill {
  height: 100%;
  background: #58a6ff;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.usage-bar-fill.bar-enterprise {
  background: linear-gradient(90deg, #2ea44f 0%, #3fb950 100%);
  box-shadow: 0 0 8px rgba(63, 185, 80, 0.4);
}

.usage-bar-fill.bar-warn {
  background: #d29922;
}

.usage-bar-fill.bar-danger {
  background: #f85149;
}

.license-status-display {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 10px 14px;
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}

.status-label {
  color: #8b949e;
}

.status-value {
  color: #c9d1d9;
  font-weight: 500;
}

.status-value.highlight {
  color: #58a6ff;
}

.promo-tip {
  font-size: 12px;
  color: #d29922;
  background: rgba(210, 153, 34, 0.08);
  border: 1px solid rgba(210, 153, 34, 0.25);
  border-radius: 6px;
  padding: 8px 12px;
  margin-bottom: 12px;
  line-height: 1.5;
}

.license-info-row {
  margin-bottom: 14px;
}

.info-label {
  display: block;
  font-size: 13px;
  color: #8b949e;
  margin-bottom: 6px;
}

.machine-id-container {
  display: flex;
  gap: 8px;
}

.machine-id-container code {
  flex: 1;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 8px 12px;
  font-family: monospace;
  font-size: 12px;
  color: #c9d1d9;
  display: flex;
  align-items: center;
  overflow-x: auto;
}

.copy-btn {
  background: #21262d;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #c9d1d9;
  cursor: pointer;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  transition: all 0.2s;
}

.copy-btn:hover {
  background: #30363d;
  border-color: #8b949e;
}

.license-input-group {
  margin-bottom: 12px;
}

.license-input-group label {
  display: block;
  font-size: 13px;
  color: #8b949e;
  margin-bottom: 6px;
}

.license-input-group textarea {
  width: 100%;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #c9d1d9;
  font-family: monospace;
  font-size: 12px;
  padding: 10px;
  box-sizing: border-box;
  resize: none;
  outline: none;
  margin-bottom: 10px;
}

.license-input-group textarea:focus {
  border-color: var(--accent);
}

.activate-btn {
  width: 100%;
  background: #238636;
  border: 1px solid #2ea44f;
  border-radius: 6px;
  color: #ffffff;
  padding: 10px 16px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.activate-btn:hover:not(:disabled) {
  background: #2ea44f;
}

.activate-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.activation-error-msg {
  color: #f85149;
  background: rgba(248, 81, 73, 0.05);
  border: 1px solid rgba(248, 81, 73, 0.1);
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  margin-bottom: 4px;
  text-align: center;
}

.purchase-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 10px;
  font-size: 12px;
}

.purchase-tip {
  color: #8b949e;
}

.purchase-link {
  color: #d29922;
  text-decoration: none;
  font-weight: 500;
}

.purchase-link:hover {
  text-decoration: underline;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
