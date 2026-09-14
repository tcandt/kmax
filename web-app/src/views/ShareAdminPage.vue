<template>
  <div class="share-admin-page">
    <div class="page-header">
      <h2>🔗 Share & Card Key Management</h2>
      <div class="header-actions">
        <button class="btn-card-connect" @click="showCardModal = true">🔑 Card Key Connect</button>
        <select v-model="selectedAddress" class="addr-select" title="Server address used for share links">
          <option v-for="addr in serverAddresses" :key="addr" :value="addr">{{ addr }}</option>
        </select>
        <button class="btn-refresh" :disabled="loading" @click="fetchShares">
          {{ loading ? 'Refreshing...' : '🔄 Refresh' }}
        </button>
      </div>
    </div>

    <!-- Card Key Connect Modal -->
    <CardConnectModal :visible="showCardModal" @close="showCardModal = false" />

    <!-- Granular guest permissions & settings modal -->
    <ShareGuestSettingsModal
      v-if="guestConfigFor"
      :share="guestConfigFor"
      @close="guestConfigFor = null"
      @saved="onGuestConfigSaved"
    />

    <!-- Instructions Banner -->
    <div class="tips-card">
      <div class="tips-header" @click="tipsCollapsed = !tipsCollapsed">
        <span>💡 Guide & Instructions</span>
        <span class="tips-toggle">{{ tipsCollapsed ? 'Expand ▾' : 'Collapse ▴' }}</span>
      </div>
      <ul v-show="!tipsCollapsed" class="tips-list">
        <li><b>Two Access Methods</b>: Direct share URL or 8-digit card code (use "Card Key Connect" on top right or login page). Both are equivalent.</li>
        <li><b>Passwordless Guest Access</b>: Guests open the link directly into the assigned device without an account and cannot see other devices.</li>
        <li><b>Permission Modes</b>: <span class="tag-full">⚡ Full Control</span> enables touch/keyboard input; <span class="tag-view">👁️ View Only</span> allows video/audio only (all input commands discarded by server).</li>
        <li><b>Granular Permissions</b>: Click "⚙️ Config" per share to lock bitrate, FPS, resolution, or audio and enforce server presets.</li>
        <li><b>Access Password</b>: When a PIN is configured, guests must enter the password to gain access.</li>
        <li><b>Expiration & Revocation</b>: Shares expire automatically. Use "Extend" to lengthen validity, or "Revoke" to disconnect guests immediately.</li>
        <li><b>Server Address</b>: Select the appropriate host/domain in the top right (supports IPv4/IPv6 and DDNS/tunnels).</li>
        <li><b>Persistence</b>: Active shares are persisted on the server and remain valid across restarts.</li>
      </ul>
    </div>

    <!-- List -->
    <div v-if="loading && shares.length === 0" class="state-block">Loading share records...</div>
    <div v-else-if="shares.length === 0" class="state-block">
      📭 No active shares. Open any device card menu and select "Share Device / Card Key" to create one.
    </div>
    <div v-else class="table-wrapper">
      <table class="share-table">
        <thead>
          <tr>
            <th>Card Code</th>
            <th>Target Device</th>
            <th>Permissions</th>
            <th>Status</th>
            <th>Expiration</th>
            <th>Notes</th>
            <th>Creator</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in shares" :key="item.token_id">
            <td><span class="card-badge">{{ item.card_code }}</span></td>
            <td class="device-cell">{{ item.device_id }}</td>
            <td>
              <span :class="['mode-badge', item.access_mode]">
                {{ item.access_mode === 'full' ? '⚡ Full Control' : '👁️ View Only' }}
              </span>
              <div v-if="lockSummary(item)" class="lock-summary">{{ lockSummary(item) }}</div>
            </td>
            <td>
              <span v-if="item.active_connections > 0" class="conn-badge online">
                🟢 {{ item.active_connections }} online
              </span>
              <span v-else class="conn-badge idle">⚪ Idle</span>
            </td>
            <td>
              <div class="time-cell">{{ formatExpire(item.expires_at) }}</div>
              <div class="remain-cell">{{ formatRemain(item.expires_at) }}</div>
            </td>
            <td class="desc-cell">{{ item.description || '-' }}</td>
            <td class="creator-cell">{{ item.creator }}</td>
            <td class="action-cell">
              <button class="table-btn copy-sm" @click="copyText(fullShareUrl(item.token_id), item.token_id)">
                {{ copiedId === item.token_id ? 'Copied ✓' : 'Copy Link' }}
              </button>
              <button class="table-btn config-sm" title="Guest permissions & presets" @click="guestConfigFor = item">⚙️ Config</button>
              <button v-if="parseExpire(item.expires_at)" class="table-btn extend-sm" @click.stop="openExtendMenu(item.token_id, $event)">Extend ▾</button>
              <button class="table-btn revoke-sm" @click="revokeShare(item.token_id)">Revoke</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Extend dropdown: fixed positioning -->
    <div v-if="extendMenuFor" class="extend-overlay" @click="extendMenuFor = ''"></div>
    <div v-if="extendMenuFor" class="extend-menu" :style="extendMenuStyle" @click.stop>
      <button v-for="opt in extendOptions" :key="opt.sec" class="extend-item" @click="extendShare(extendMenuFor, opt.sec)">
        +{{ opt.label }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import CardConnectModal from '@/components/CardConnectModal.vue'
import ShareGuestSettingsModal from '@/components/ShareGuestSettingsModal.vue'
import { useAuthStore } from '@/stores/auth'

const shares = ref([])
const loading = ref(false)
const copiedId = ref('')
const serverAddresses = ref([])
const selectedAddress = ref('')
const showCardModal = ref(false)
const guestConfigFor = ref(null)
const extendMenuFor = ref('')
const extendMenuPos = ref({ top: 0, left: 0 })
const extendOptions = [
  { label: '30 Minutes', sec: 1800 },
  { label: '1 Hour', sec: 3600 },
  { label: '12 Hours', sec: 43200 },
  { label: '1 Day', sec: 86400 },
  { label: '7 Days', sec: 604800 }
]

const EXTEND_MENU_WIDTH = 100
const extendMenuStyle = computed(() => ({
  top: extendMenuPos.value.top + 'px',
  left: extendMenuPos.value.left + 'px'
}))

function openExtendMenu(tokenID, e) {
  if (extendMenuFor.value === tokenID) {
    extendMenuFor.value = ''
    return
  }
  const rect = e.currentTarget.getBoundingClientRect()
  const menuHeight = extendOptions.length * 32 + 10
  let top = rect.bottom + 4
  // Open upwards if insufficient room below
  if (top + menuHeight > window.innerHeight - 8) {
    top = rect.top - menuHeight - 4
  }
  let left = rect.right - EXTEND_MENU_WIDTH
  if (left < 8) left = 8
  extendMenuPos.value = { top, left }
  extendMenuFor.value = tokenID
}
const tipsCollapsed = ref(localStorage.getItem('share_admin_tips_collapsed') === '1')

// Persist instructions banner collapsed state
watch(tipsCollapsed, (v) => {
  try { localStorage.setItem('share_admin_tips_collapsed', v ? '1' : '0') } catch (e) {}
})

function getAuthHeaders() {
  const t = localStorage.getItem('auth_token') || ''
  const headers = { 'Content-Type': 'application/json' }
  if (t) headers['Authorization'] = `Bearer ${t}`
  return headers
}

async function fetchShares() {
  loading.value = true
  try {
    // Return all shares accessible to current user
    const res = await fetch('/api/share/list', { headers: getAuthHeaders() })
    if (res.ok) {
      const json = await res.json()
      if (json.code === 0) {
        shares.value = (json.data || []).slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      }
    }
  } catch (e) {
  } finally {
    loading.value = false
  }
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

function fullShareUrl(token) {
  const host = selectedAddress.value || window.location.host
  return `${window.location.protocol}//${host}/share?token=${encodeURIComponent(token)}`
}

function copyText(text, id) {
  navigator.clipboard.writeText(text).then(() => {
    copiedId.value = id
    setTimeout(() => {
      if (copiedId.value === id) copiedId.value = ''
    }, 2000)
  })
}

async function revokeShare(tokenID) {
  if (!confirm('Are you sure you want to revoke this share? Card key and URL will expire immediately and connected guests will be disconnected.')) return
  try {
    const res = await fetch('/api/share/revoke', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ token: tokenID })
    })
    if (res.ok) fetchShares()
  } catch (e) {}
}

async function extendShare(tokenID, seconds) {
  extendMenuFor.value = ''
  try {
    const res = await fetch('/api/share/extend', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ token: tokenID, extend_seconds: seconds })
    })
    const json = await res.json().catch(() => ({}))
    if (res.ok && json.code === 0) {
      fetchShares()
    } else {
      alert('Failed to extend: ' + (json.msg || ('HTTP ' + res.status)))
    }
  } catch (e) {
    alert('Network request error: ' + e.message)
  }
}

// Granular permission summary: show locked badges
function lockSummary(item) {
  const parts = []
  if (item.forbid_bitrate) parts.push('Bitrate')
  if (item.forbid_fps) parts.push('FPS')
  if (item.forbid_resolution) parts.push('Resolution')
  if (item.forbid_audio) parts.push('Audio')
  return parts.length ? `🔒 ${parts.join('·')}` : ''
}

function onGuestConfigSaved() {
  guestConfigFor.value = null
  fetchShares()
}

function parseExpire(expiresAt) {
  if (!expiresAt) return null
  const t = new Date(expiresAt)
  if (Number.isNaN(t.getTime()) || t.getFullYear() <= 1) return null // Go zero time = permanent
  return t
}

function formatExpire(expiresAt) {
  const t = parseExpire(expiresAt)
  if (!t) return '♾️ Permanent'
  return t.toLocaleString('zh-CN', { hour12: false })
}

function formatRemain(expiresAt) {
  const t = parseExpire(expiresAt)
  if (!t) return ''
  const ms = t.getTime() - Date.now()
  if (ms <= 0) return 'Expired'
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (d > 0) return `${d}d ${h}h left`
  if (h > 0) return `${h}h ${m}m left`
  return `${m}m left`
}

// Auto refresh status every 15s while staying on page
let refreshTimer = null

onMounted(() => {
  // Only admins can access share admin page
  const authStore = useAuthStore()
  if (!authStore.isAdmin) {
    window.dispatchEvent(new CustomEvent('cloudphone-navigate', { detail: '/' }))
    return
  }
  fetchShares()
  fetchServerAddresses()
  refreshTimer = setInterval(fetchShares, 15000)
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<style scoped>
.share-admin-page {
  padding: 24px;
  height: 100%;
  overflow-y: auto;
  color: #c9d1d9;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 10px;
}

.page-header h2 {
  margin: 0;
  font-size: 1.15rem;
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.addr-select {
  padding: 7px 10px;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #c9d1d9;
  font-size: 0.82rem;
  max-width: 260px;
}

.btn-refresh {
  padding: 7px 16px;
  background: #21262d;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #c9d1d9;
  font-size: 0.84rem;
  cursor: pointer;
}

.btn-refresh:hover {
  background: #30363d;
}

.btn-card-connect {
  padding: 7px 16px;
  background: linear-gradient(135deg, #6366f1, #a855f7);
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
}

.tips-card {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 10px;
  margin-bottom: 18px;
  overflow: hidden;
}

.tips-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  user-select: none;
}

.tips-header:hover {
  background: rgba(88, 166, 255, 0.05);
}

.tips-toggle {
  color: #8b949e;
  font-size: 0.78rem;
  font-weight: 400;
}

.tips-list {
  margin: 0;
  padding: 0 14px 12px 32px;
  font-size: 0.82rem;
  line-height: 1.7;
  color: #8b949e;
}

.tips-list b {
  color: #c9d1d9;
}

.tips-list code {
  background: #0d1117;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 0.78rem;
}

.tag-full { color: #818cf8; }
.tag-view { color: #fbbf24; }

.state-block {
  padding: 48px;
  text-align: center;
  color: #8b949e;
  background: #161b22;
  border: 1px dashed #30363d;
  border-radius: 10px;
  font-size: 0.9rem;
}

.table-wrapper {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 10px;
  overflow-x: auto;
}

.share-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.84rem;
}

.share-table th, .share-table td {
  padding: 10px 14px;
  text-align: left;
  border-bottom: 1px solid #21262d;
  white-space: nowrap;
}

.share-table th {
  color: #8b949e;
  font-weight: 500;
  background: #0d1117;
}

.card-badge {
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
  padding: 2px 8px;
  border-radius: 4px;
  font-family: monospace;
  font-weight: 600;
}

.device-cell {
  font-family: monospace;
  font-size: 0.8rem;
}

.mode-badge {
  font-size: 0.78rem;
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

.time-cell {
  font-size: 0.82rem;
}

.remain-cell {
  font-size: 0.72rem;
  color: #8b949e;
}

.desc-cell {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.creator-cell {
  color: #8b949e;
}

.action-cell {
  display: flex;
  gap: 6px;
}

.table-btn {
  border: none;
  padding: 5px 10px;
  border-radius: 5px;
  font-size: 0.78rem;
  cursor: pointer;
}

.copy-sm {
  background: #30363d;
  color: #c9d1d9;
}

.copy-sm:hover {
  background: #0284c7;
  color: #fff;
}

.revoke-sm {
  background: rgba(244, 63, 94, 0.15);
  color: #f43f5e;
}

.revoke-sm:hover {
  background: #f43f5e;
  color: #fff;
}

.conn-badge {
  font-size: 0.78rem;
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
}

.conn-badge.online {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.conn-badge.idle {
  background: rgba(148, 163, 184, 0.12);
  color: #8b949e;
}

.extend-sm {
  background: rgba(56, 189, 248, 0.12);
  color: #38bdf8;
}

.extend-sm:hover {
  background: #0284c7;
  color: #fff;
}

.config-sm {
  background: rgba(163, 113, 247, 0.12);
  color: #a371f7;
}

.config-sm:hover {
  background: #a371f7;
  color: #fff;
}

.lock-summary {
  font-size: 0.72rem;
  color: #fbbf24;
  margin-top: 4px;
  white-space: nowrap;
}

.extend-menu {
  position: fixed;
  z-index: 60;
  width: 100px;
  padding: 4px;
  background: #1c2230;
  border: 1px solid #30363d;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
}

.extend-item {
  background: transparent;
  border: none;
  color: #c9d1d9;
  font-size: 0.8rem;
  text-align: left;
  padding: 7px 10px;
  border-radius: 5px;
  cursor: pointer;
  white-space: nowrap;
}

.extend-item:hover {
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
}

.extend-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
}

/* Mobile layout adjustments */
@media (max-width: 1024px) {
  .share-admin-page {
    padding: 12px;
  }

  /* Header wrap */
  .page-header {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .page-header h2 {
    font-size: 1.05rem;
  }

  .header-actions {
    flex-wrap: wrap;
    width: 100%;
  }

  .addr-select {
    flex: 1;
    min-width: 0;
    max-width: none;
    font-size: 0.78rem;
  }

  .btn-card-connect,
  .btn-refresh {
    padding: 7px 12px;
    font-size: 0.8rem;
    white-space: nowrap;
  }

  .tips-list {
    padding: 0 12px 10px 26px;
    font-size: 0.78rem;
  }

  .state-block {
    padding: 28px 14px;
  }

  /* Scrollable table container */
  .table-wrapper {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .share-table {
    font-size: 0.78rem;
  }

  .share-table th,
  .share-table td {
    padding: 8px 10px;
  }

  .desc-cell {
    max-width: 120px;
  }

  /* Actions buttons wrap */
  .action-cell {
    flex-wrap: wrap;
    gap: 4px;
    min-width: 140px;
  }

  .table-btn {
    padding: 4px 8px;
    font-size: 0.74rem;
  }

  /* Extend menu constrained width */
  .extend-menu {
    max-width: 94vw;
  }
}
</style>
