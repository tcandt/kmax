<template>
  <div v-if="visible" class="modal-backdrop" @click.self.stop="close" @click.stop>
    <div class="modal-container dark-theme glow-border" @click.stop>
      <!-- Header -->
      <div class="modal-header">
        <div class="header-title">
          <span class="icon">🔗</span>
          <h3>Device Sharing & Card Key Generation</h3>
        </div>
        <button type="button" class="close-btn" @click.stop.prevent="close">✕</button>
      </div>

      <div class="modal-body custom-scrollbar">
        <!-- Device Info Banner -->
        <div class="device-badge">
          <span class="label">Target Device:</span>
          <span class="device-id">{{ deviceId }}</span>
        </div>

        <!-- Tab switcher: New Share / Existing Shares -->
        <div class="tab-header">
          <button 
            type="button"
            :class="['tab-btn', { active: activeTab === 'create' }]"
            @click.stop.prevent="activeTab = 'create'"
          >
            ✨ Create Share
          </button>
          <button 
            type="button"
            :class="['tab-btn', { active: activeTab === 'list' }]"
            @click.stop.prevent="fetchShareList(); activeTab = 'list'"
          >
            📋 Active Links & Keys ({{ shareList.length }})
          </button>
        </div>

        <!-- New Share Tab Content -->
        <div v-if="activeTab === 'create'" class="form-section">
          <!-- Core settings grid -->
          <div class="form-grid">
            <!-- Validity duration settings -->
            <div class="form-group">
              <label>⏱️ Validity Duration</label>
              <select v-model="expireOption" class="custom-select">
                <option :value="1800">30 Minutes</option>
                <option :value="3600">1 Hour</option>
                <option :value="43200">12 Hours</option>
                <option :value="86400">24 Hours (1 Day)</option>
                <option :value="604800">7 Days</option>
                <option :value="0">♾️ Never Expires (Permanent)</option>
                <option value="custom">⚙️ Custom Days</option>
              </select>
              <input 
                v-if="expireOption === 'custom'" 
                v-model.number="customDays" 
                type="number" 
                min="1" 
                placeholder="Enter number of days..." 
                class="custom-input mt-2"
              />
            </div>

            <!-- Control mode -->
            <div class="form-group">
              <label>🎮 Access & Control Permissions</label>
              <div class="radio-group">
                <label :class="['radio-card', { selected: accessMode === 'full' }]">
                  <input type="radio" value="full" v-model="accessMode" />
                  <span class="radio-title">⚡ Full Control</span>
                  <span class="radio-desc">Allows video stream + touch input + keyboard/mouse injection</span>
                </label>
                <label :class="['radio-card', { selected: accessMode === 'view_only' }]">
                  <input type="radio" value="view_only" v-model="accessMode" />
                  <span class="radio-title">👁️ View Only (Read-Only)</span>
                  <span class="radio-desc">Real-time video only; all touch and control inputs disabled</span>
                </label>
              </div>
            </div>

            <!-- Granular settings permissions -->
            <div class="form-group">
              <label>🎚️ Settings Guest Can Modify</label>
              <div class="perm-checks">
                <label class="perm-check"><input type="checkbox" v-model="allowBitrate" /> Bitrate</label>
                <label class="perm-check"><input type="checkbox" v-model="allowFps" /> FPS</label>
                <label class="perm-check"><input type="checkbox" v-model="allowResolution" /> Resolution</label>
                <label class="perm-check"><input type="checkbox" v-model="allowAudio" /> Audio</label>
              </div>
              <span class="addr-hint">Unchecked items cannot be modified by guests; preset values configurable in Share Management ⚙️</span>
            </div>

            <!-- Optional access password -->
            <div class="form-group">
              <label>🔒 Access Password (PIN, optional)</label>
              <input 
                v-model="password" 
                type="password" 
                placeholder="Leave blank for passwordless direct access" 
                class="custom-input"
              />
            </div>

            <!-- Notes / Description -->
            <div class="form-group">
              <label>📝 Share Notes (Optional)</label>
              <input 
                v-model="description" 
                type="text" 
                placeholder="e.g. For QA testing and debugging" 
                class="custom-input"
              />
            </div>

            <!-- Share link host -->
            <div class="form-group">
              <label>🌐 Share Link Host</label>
              <select v-model="selectedAddress" class="custom-select">
                <option v-for="addr in serverAddresses" :key="addr" :value="addr">{{ addr }}</option>
              </select>
              <span class="addr-hint">Select server host accessible by guests (IPv4/IPv6)</span>
            </div>
          </div>

          <div class="action-bar">
            <button type="button" class="btn-primary glow-btn" :disabled="loading" @click.stop.prevent="createShare">
              <span v-if="loading" class="spinner"></span>
              <span v-else>🚀 Generate Share Link & Card Key</span>
            </button>
          </div>

          <!-- Result display banner -->
          <div v-if="createdResult" class="result-card">
            <div class="result-header">
              <span class="check-icon">✓</span>
              <h4>Share Link & Card Key Generated Successfully!</h4>
            </div>

            <div class="result-row">
              <label>🔑 Card Key Code:</label>
              <div class="code-box highlight-card-code">{{ createdResult.card_code }}</div>
              <button type="button" class="copy-btn" @click.stop.prevent="copyText(createdResult.card_code, 'card')">
                {{ copiedType === 'card' ? 'Copied ✓' : 'Copy Card Key' }}
              </button>
            </div>

            <div class="result-row mt-3">
              <label>🔗 Full Share Link:</label>
              <input type="text" readonly :value="fullShareUrl(createdResult.token)" class="url-input" />
              <button type="button" class="copy-btn" @click.stop.prevent="copyText(fullShareUrl(createdResult.token), 'url')">
                {{ copiedType === 'url' ? 'Copied ✓' : 'Copy Link' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Active Links & Keys Tab Content -->
        <div v-else class="list-section">
          <div v-if="listLoading" class="loading-state">Loading share records...</div>
          <div v-else-if="shareList.length === 0" class="empty-state">
            <span>📭 No active share links or card keys</span>
          </div>
          <div v-else class="share-table-wrapper">
            <table class="share-table">
              <thead>
                <tr>
                  <th>Card Code</th>
                  <th>Permissions</th>
                  <th>Expiration</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in shareList" :key="item.token_id">
                  <td>
                    <span class="card-badge">{{ item.card_code }}</span>
                  </td>
                  <td>
                    <span :class="['mode-badge', item.access_mode]">
                      {{ item.access_mode === 'full' ? '⚡ Full Control' : '👁️ View Only' }}
                    </span>
                  </td>
                  <td>
                    <span class="time-text">{{ formatTime(item.expires_at) }}</span>
                  </td>
                  <td class="desc-cell">{{ item.description || '-' }}</td>
                  <td class="action-cell">
                    <button type="button" class="table-btn copy-sm" @click.stop.prevent="copyText(fullShareUrl(item.token_id), 'list-' + item.token_id)">
                      {{ copiedType === 'list-' + item.token_id ? 'Copied' : 'Copy Link' }}
                    </button>
                    <button type="button" class="table-btn revoke-sm" @click.stop.prevent="revokeShare(item.token_id)">
                      Revoke
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  deviceId: { type: String, required: true }
})

const emit = defineEmits(['close'])

const activeTab = ref('create')
const expireOption = ref(86400)
const customDays = ref(1)
const accessMode = ref('full')
const allowBitrate = ref(true)
const allowFps = ref(true)
const allowResolution = ref(true)
const allowAudio = ref(true)
const password = ref('')
const description = ref('')
const loading = ref(false)
const listLoading = ref(false)
const createdResult = ref(null)
const shareList = ref([])
const copiedType = ref('')
const serverAddresses = ref([])
const selectedAddress = ref('')

function getAuthHeaders() {
  const t = localStorage.getItem('auth_token') || ''
  const headers = { 'Content-Type': 'application/json' }
  if (t) {
    headers['Authorization'] = `Bearer ${t}`
  }
  return headers
}

async function createShare() {
  loading.value = true
  createdResult.value = null

  let seconds = Number(expireOption.value)
  if (expireOption.value === 'custom') {
    seconds = (customDays.value || 1) * 86400
  }

  try {
    const res = await fetch('/api/share/create', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        device_id: props.deviceId,
        expire_seconds: seconds,
        access_mode: accessMode.value,
        password: password.value,
        description: description.value,
        forbid_bitrate: !allowBitrate.value,
        forbid_fps: !allowFps.value,
        forbid_resolution: !allowResolution.value,
        forbid_audio: !allowAudio.value
      })
    })

    if (!res.ok) {
      // 409: device already has active share; show server JSON msg
      let errMsg = 'HTTP ' + res.status
      try {
        const errJson = await res.json()
        if (errJson && errJson.msg) errMsg = errJson.msg
      } catch (e) {}
      alert('Failed to create: ' + errMsg)
      return
    }

    const json = await res.json()
    if (json.code === 0) {
      createdResult.value = json.data
      fetchShareList()
    } else {
      alert('Failed to create: ' + (json.msg || 'Unknown error'))
    }
  } catch (err) {
    alert('Network request error: ' + err.message)
  } finally {
    loading.value = false
  }
}

async function fetchShareList() {
  listLoading.value = true
  try {
    const res = await fetch(`/api/share/list?device_id=${encodeURIComponent(props.deviceId)}`, {
      headers: getAuthHeaders()
    })
    if (res.ok) {
      const json = await res.json()
      if (json.code === 0) {
        shareList.value = json.data || []
      }
    }
  } catch (e) {
  } finally {
    listLoading.value = false
  }
}

async function revokeShare(tokenID) {
  if (!confirm('Are you sure you want to revoke this share link and card key? Guests will be disconnected immediately.')) return
  try {
    const res = await fetch('/api/share/revoke', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ token: tokenID })
    })
    if (res.ok) {
      fetchShareList()
    }
  } catch (e) {}
}

function copyText(text, type) {
  navigator.clipboard.writeText(text).then(() => {
    copiedType.value = type
    setTimeout(() => {
      if (copiedType.value === type) copiedType.value = ''
    }, 2000)
  })
}

function close() {
  emit('close')
}

function fullShareUrl(token) {
  const host = selectedAddress.value || window.location.host
  return `${window.location.protocol}//${host}/share?token=${encodeURIComponent(token)}`
}

async function fetchServerAddresses() {
  try {
    const res = await fetch('/api/server/addresses', { headers: getAuthHeaders() })
    if (!res.ok) return
    const json = await res.json()
    if (json.code === 0 && json.data) {
      serverAddresses.value = json.data.addresses || []
      selectedAddress.value = json.data.current || serverAddresses.value[0] || ''
    }
  } catch (e) {}
}

function formatTime(expiresAt) {
  if (!expiresAt) return '-'
  const t = new Date(expiresAt)
  if (Number.isNaN(t.getTime())) return '-'
  // Go zero time represents permanent validity
  if (t.getFullYear() <= 1) return '♾️ Never Expires'
  return t.toLocaleString('zh-CN', { hour12: false })
}

watch(() => props.visible, (val) => {
  if (val) {
    createdResult.value = null
    activeTab.value = 'create'
    fetchShareList()
    fetchServerAddresses()
  }
})
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(10, 12, 20, 0.75);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal-container {
  width: 580px;
  max-width: 92vw;
  max-height: 90vh;
  background: #141824;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(56, 189, 248, 0.15);
  display: flex;
  flex-direction: column;
  color: #f1f5f9;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  overflow: hidden;
}

.modal-header {
  padding: 16px 20px;
  background: #1a2030;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-title h3 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
  background: linear-gradient(135deg, #38bdf8, #818cf8);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.close-btn {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 1.3rem;
  cursor: pointer;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #f43f5e;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
}

.device-badge {
  background: rgba(30, 41, 59, 0.8);
  border: 1px dashed rgba(56, 189, 248, 0.3);
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 0.9rem;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.device-badge .label {
  color: #94a3b8;
}

.device-badge .device-id {
  color: #38bdf8;
  font-weight: 600;
  font-family: monospace;
}

.tab-header {
  display: flex;
  gap: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 20px;
}

.tab-btn {
  background: none;
  border: none;
  color: #94a3b8;
  padding: 8px 16px;
  font-size: 0.95rem;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.tab-btn.active {
  color: #38bdf8;
  border-bottom-color: #38bdf8;
  font-weight: 600;
}

.form-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group label {
  display: block;
  font-size: 0.88rem;
  color: #cbd5e1;
  margin-bottom: 6px;
  font-weight: 500;
}

.custom-select, .custom-input {
  width: 100%;
  padding: 10px 14px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  color: #f8fafc;
  font-size: 0.92rem;
  outline: none;
  transition: border-color 0.2s;
}

.custom-select:focus, .custom-input:focus {
  border-color: #38bdf8;
}

.addr-hint {
  display: block;
  margin-top: 6px;
  font-size: 0.75rem;
  color: #64748b;
}

.perm-checks {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  margin-top: 2px;
}

.perm-check {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.85rem;
  color: #c9d1d9;
  cursor: pointer;
}

.perm-check input {
  accent-color: #6366f1;
}

.mt-2 { margin-top: 8px; }
.mt-3 { margin-top: 12px; }

.radio-group {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.radio-card {
  padding: 12px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: all 0.2s;
}

.radio-card input {
  display: none;
}

.radio-card.selected {
  border-color: #38bdf8;
  background: rgba(56, 189, 248, 0.08);
}

.radio-title {
  font-weight: 600;
  font-size: 0.9rem;
  color: #f1f5f9;
}

.radio-desc {
  font-size: 0.76rem;
  color: #94a3b8;
  line-height: 1.3;
}

.action-bar {
  margin-top: 24px;
}

.btn-primary {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #0284c7, #6366f1);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-weight: 600;
  font-size: 0.98rem;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(2, 132, 199, 0.4);
}

.result-card {
  margin-top: 20px;
  padding: 16px;
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 12px;
}

.result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #10b981;
  margin-bottom: 12px;
}

.result-header h4 {
  margin: 0;
  font-size: 0.95rem;
}

.result-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.result-row label {
  font-size: 0.85rem;
  color: #94a3b8;
  width: 100px;
  flex-shrink: 0;
}

.code-box {
  background: #0f172a;
  border: 1px solid #38bdf8;
  color: #38bdf8;
  padding: 6px 14px;
  border-radius: 6px;
  font-family: monospace;
  font-weight: bold;
  font-size: 1.1rem;
  letter-spacing: 1px;
}

.url-input {
  flex: 1;
  background: #0f172a;
  border: 1px solid #334155;
  color: #f1f5f9;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 0.82rem;
}

.copy-btn {
  background: #334155;
  border: none;
  color: #f8fafc;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 0.82rem;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.2s;
}

.copy-btn:hover {
  background: #0284c7;
}

.share-table-wrapper {
  overflow-x: auto;
}

.share-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.86rem;
}

.share-table th, .share-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid #1e293b;
}

.share-table th {
  color: #94a3b8;
  font-weight: 500;
  background: #0f172a;
}

.card-badge {
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
  padding: 2px 8px;
  border-radius: 4px;
  font-family: monospace;
  font-weight: 600;
}

.mode-badge {
  font-size: 0.8rem;
  padding: 2px 6px;
  border-radius: 4px;
}

.mode-badge.full {
  background: rgba(99, 102, 241, 0.2);
  color: #818cf8;
}

.mode-badge.view_only {
  background: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
}

.action-cell {
  display: flex;
  gap: 6px;
}

.table-btn {
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.78rem;
  cursor: pointer;
}

.copy-sm {
  background: #334155;
  color: #f1f5f9;
}

.revoke-sm {
  background: rgba(244, 63, 94, 0.2);
  color: #f43f5e;
}

.revoke-sm:hover {
  background: #f43f5e;
  color: #fff;
}
</style>
