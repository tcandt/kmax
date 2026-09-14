<template>
  <div class="guest-config-overlay" @click.self="$emit('close')">
    <div class="guest-config-modal">
      <div class="gc-header">
        <span>⚙️ User Policy — {{ user.username }}</span>
        <button class="gc-close" @click="$emit('close')">×</button>
      </div>

      <div class="gc-body">
        <div class="gc-section-title">Modifiable Options (Setting Lock)</div>
        <label class="gc-toggle-row" v-for="dim in dims" :key="dim.key">
          <input type="checkbox" v-model="dim.allow.value" />
          <span>{{ dim.label }}</span>
        </label>
        <div class="gc-hint">Unchecked options: controls are grayed out and locked in user panel, enforced by server on next connection.</div>

        <div class="gc-section-title">Preset Values</div>
        <div class="gc-summary">
          <template v-if="draftSettings">
            <span>Bitrate {{ bitrateText }} · FPS {{ draftSettings.fps || 'Unlimited' }} · Resolution {{ draftSettings.size || 'Unlimited' }} · Audio {{ draftSettings.audio ? 'On' : 'Off' }}</span>
          </template>
          <template v-else>
            <span class="gc-none">Not configured (locked items fall back to device defaults)</span>
          </template>
        </div>
        <div class="gc-actions-row">
          <button class="gc-btn" @click="openEditor">Edit Preset Values…</button>
          <button v-if="draftSettings" class="gc-btn gc-btn-danger" @click="draftSettings = null">Clear Settings</button>
        </div>

        <div class="gc-section-title">Device Quota (Max Devices)</div>
        <div class="gc-summary">
          <span>Current Quota: {{ deviceQuota === 0 ? '♾️ Unlimited' : `${deviceQuota} devices` }}</span>
        </div>
        <div class="gc-expire-row">
          <input
            v-model.number="deviceQuota"
            type="number"
            min="0"
            max="9999"
            placeholder="0 = Unlimited"
            class="gc-select"
            style="width: 100%;"
          />
        </div>
        <div class="gc-hint">Maximum simultaneous devices allocated to this user. Enter 0 for unlimited.</div>

        <div class="gc-section-title">Account Validity</div>
        <div class="gc-summary">
          <span>Current: {{ expiryText }}</span>
        </div>
        <div class="gc-expire-row">
          <select v-model="expireChoice" class="gc-select">
            <option value="keep">Keep Current</option>
            <option value="0">♾️ Never Expires</option>
            <option value="1800">30 minutes (from now)</option>
            <option value="3600">1 hour (from now)</option>
            <option value="43200">12 hours (from now)</option>
            <option value="86400">1 day (from now)</option>
            <option value="604800">7 days (from now)</option>
            <option value="custom">⚙️ Custom days…</option>
          </select>
          <input
            v-if="expireChoice === 'custom'"
            v-model.number="customDays"
            type="number"
            min="1"
            placeholder="Days"
            class="gc-select gc-minutes"
          />
        </div>
        <div class="gc-hint">Upon expiration, user cannot log in and active sessions will be terminated; extend expiration to restore.</div>
      </div>

      <div class="gc-footer">
        <span v-if="error" class="gc-error">{{ error }}</span>
        <div style="flex: 1"></div>
        <button class="gc-btn" @click="$emit('close')">Cancel</button>
        <button class="gc-btn gc-btn-primary" :disabled="saving" @click="save">
          {{ saving ? 'Saving...' : 'Save' }}
        </button>
      </div>
    </div>

    <!-- Embed draft editor reusing connection settings panel -->
    <SettingsModal
      v-if="showEditor"
      :settings="editorSettings"
      :is-connected="false"
      :is-global="false"
      :is-custom="false"
      @save="onEditorSave"
      @close="showEditor = false"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import SettingsModal from '@/components/SettingsModal.vue'
import { getDeviceSettings } from '@/utils/settings'

const props = defineProps({
  user: { type: Object, required: true }
})
const emit = defineEmits(['close', 'saved'])

// Allow items: invert forbid flags; initial values from current user config
const dims = [
  { key: 'bitrate', label: 'Allow adjusting bitrate (including BWE/limits)', allow: ref(!props.user.forbid_bitrate) },
  { key: 'fps', label: 'Allow adjusting frame rate (FPS)', allow: ref(!props.user.forbid_fps) },
  { key: 'resolution', label: 'Allow adjusting resolution', allow: ref(!props.user.forbid_resolution) },
  { key: 'audio', label: 'Allow adjusting audio', allow: ref(!props.user.forbid_audio) }
]

// Draft: based on global defaults, layered with saved user values
const draftSettings = ref(
  props.user.settings
    ? { ...getDeviceSettings(''), ...props.user.settings }
    : null
)

const expireChoice = ref('keep')
const customDays = ref(1)
const deviceQuota = ref(props.user.max_devices ?? 0)
const showEditor = ref(false)
const saving = ref(false)
const error = ref('')

const bitrateText = computed(() => {
  const s = draftSettings.value
  if (!s) return ''
  return s.bwe ? `${s.minBitrate}-${s.maxBitrate} Mbps (BWE)` : `${s.bitrate} Mbps`
})

// Re-edit after clearing: pull from global defaults as baseline
const editorSettings = computed(() => draftSettings.value || getDeviceSettings(''))

function parseExpire(expiresAt) {
  if (!expiresAt) return null
  const t = new Date(expiresAt)
  if (Number.isNaN(t.getTime()) || t.getFullYear() <= 1) return null // Go zero time = never expires
  return t
}

const expiryText = computed(() => {
  const t = parseExpire(props.user.expires_at)
  if (!t) return '♾️ Never Expires'
  const ms = t.getTime() - Date.now()
  if (ms <= 0) return `Expired (${t.toLocaleString('en-US', { hour12: false })})`
  return `Expires ${t.toLocaleString('en-US', { hour12: false })}`
})

function openEditor() {
  showEditor.value = true
}

function onEditorSave(newSettings) {
  draftSettings.value = newSettings
  showEditor.value = false
}

async function save() {
  saving.value = true
  error.value = ''
  try {
    const body = {
      username: props.user.username,
      forbid_bitrate: !dims[0].allow.value,
      forbid_fps: !dims[1].allow.value,
      forbid_resolution: !dims[2].allow.value,
      forbid_audio: !dims[3].allow.value,
      settings: draftSettings.value,
      max_devices: Number(deviceQuota.value) || 0
    }
    if (expireChoice.value === 'keep') {
      body.expire_seconds = -1
    } else if (expireChoice.value === 'custom') {
      body.expire_seconds = Math.max(1, customDays.value || 1) * 86400
    } else {
      body.expire_seconds = Number(expireChoice.value)
    }

    const res = await fetch('/api/admin/users/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (res.ok) {
      emit('saved')
      emit('close')
    } else {
      const txt = await res.text()
      error.value = 'Save failed: ' + (txt || ('HTTP ' + res.status))
    }
  } catch (e) {
    error.value = 'Network request error: ' + e.message
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.guest-config-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(10, 12, 16, 0.65);
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 16px;
}

.guest-config-modal {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 12px;
  width: 100%;
  max-width: 420px;
  max-height: 88vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
}

.gc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid #21262d;
  font-size: 0.95rem;
  font-weight: 600;
  color: #c9d1d9;
}

.gc-close {
  background: none;
  border: none;
  color: #8b949e;
  font-size: 1.3rem;
  cursor: pointer;
  line-height: 1;
}

.gc-close:hover {
  color: #fff;
}

.gc-body {
  padding: 14px 16px;
}

.gc-section-title {
  font-size: 0.8rem;
  color: #8b949e;
  font-weight: 600;
  margin: 14px 0 8px;
}

.gc-section-title:first-child {
  margin-top: 0;
}

.gc-toggle-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
  font-size: 0.86rem;
  color: #c9d1d9;
  cursor: pointer;
}

.gc-toggle-row input {
  accent-color: #6366f1;
}

.gc-hint {
  font-size: 0.75rem;
  color: #8b949e;
  line-height: 1.5;
  margin-top: 6px;
}

.gc-summary {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 0.82rem;
  color: #c9d1d9;
  line-height: 1.5;
}

.gc-none {
  color: #8b949e;
}

.gc-actions-row {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.gc-expire-row {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.gc-select {
  flex: 1;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #c9d1d9;
  font-size: 0.82rem;
  padding: 7px 10px;
}

.gc-minutes {
  flex: 0 0 90px;
}

.gc-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #21262d;
}

.gc-error {
  color: #f43f5e;
  font-size: 0.78rem;
}

.gc-btn {
  background: #21262d;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #c9d1d9;
  font-size: 0.82rem;
  padding: 7px 14px;
  cursor: pointer;
}

.gc-btn:hover {
  background: #30363d;
}

.gc-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.gc-btn-primary {
  background: linear-gradient(135deg, #6366f1, #a855f7);
  border: none;
  color: #fff;
  font-weight: 600;
}

.gc-btn-danger {
  color: #f43f5e;
}

.gc-btn-danger:hover {
  background: rgba(244, 63, 94, 0.15);
}
</style>
