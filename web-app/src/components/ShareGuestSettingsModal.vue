<template>
  <div class="guest-config-overlay" @click.self="$emit('close')">
    <div class="guest-config-modal">
      <div class="gc-header">
        <span>⚙️ Guest Settings — {{ share.device_id }}</span>
        <button class="gc-close" @click="$emit('close')">×</button>
      </div>

      <div class="gc-body">
        <div class="gc-section-title">Guest Modifiable Options</div>
        <label class="gc-toggle-row" v-for="dim in dims" :key="dim.key">
          <input type="checkbox" v-model="dim.allow.value" />
          <span>{{ dim.label }}</span>
        </label>
        <div class="gc-hint">Unchecked options: controls are grayed out and locked in guest panel, enforced by signaling server.</div>

        <div class="gc-section-title">Guest Preset Values</div>
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

    <!-- Embed draft editor reusing device settings panel -->
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
  share: { type: Object, required: true }
})
const emit = defineEmits(['close', 'saved'])

// Allow items: invert forbid flags; initial values from current share config
const dims = [
  { key: 'bitrate', label: 'Allow adjusting bitrate (including BWE/limits)', allow: ref(!props.share.forbid_bitrate) },
  { key: 'fps', label: 'Allow adjusting frame rate (FPS)', allow: ref(!props.share.forbid_fps) },
  { key: 'resolution', label: 'Allow adjusting resolution', allow: ref(!props.share.forbid_resolution) },
  { key: 'audio', label: 'Allow adjusting audio', allow: ref(!props.share.forbid_audio) }
]

// Draft: based on device config, layered with saved guest override
const draftSettings = ref(
  props.share.guest_settings
    ? { ...getDeviceSettings(props.share.device_id), ...props.share.guest_settings }
    : null
)

const showEditor = ref(false)
const saving = ref(false)
const error = ref('')

const bitrateText = computed(() => {
  const s = draftSettings.value
  if (!s) return ''
  return s.bwe ? `${s.minBitrate}-${s.maxBitrate} Mbps (BWE)` : `${s.bitrate} Mbps`
})

// Re-edit after clearing: pull from device config as baseline
const editorSettings = computed(() => draftSettings.value || getDeviceSettings(props.share.device_id))

function openEditor() {
  showEditor.value = true
}

function onEditorSave(newSettings) {
  draftSettings.value = newSettings
  showEditor.value = false
}

function getAuthHeaders() {
  const t = localStorage.getItem('auth_token') || ''
  const headers = { 'Content-Type': 'application/json' }
  if (t) headers['Authorization'] = `Bearer ${t}`
  return headers
}

async function save() {
  saving.value = true
  error.value = ''
  try {
    const res = await fetch('/api/share/update', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        token: props.share.token_id,
        forbid_bitrate: !dims[0].allow.value,
        forbid_fps: !dims[1].allow.value,
        forbid_resolution: !dims[2].allow.value,
        forbid_audio: !dims[3].allow.value,
        guest_settings: draftSettings.value
      })
    })
    const json = await res.json().catch(() => ({}))
    if (res.ok && json.code === 0) {
      emit('saved')
      emit('close')
    } else {
      error.value = 'Save failed: ' + (json.msg || ('HTTP ' + res.status))
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
  margin: 10px 0 8px;
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
