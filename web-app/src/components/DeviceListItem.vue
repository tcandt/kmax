<template>
  <div
    class="device-table-row"
    ref="rowElement"
    :class="{ offline: device.status !== 'online' }"
    @click="onRowClick"
  >
    <!-- Col 1: Group control select / Master badge -->
    <div class="cell col-select" @click.stop>
      <div v-if="groupControlStore.isGroupControlActive && device.status === 'online'" class="group-select-wrap">
        <span v-if="groupControlStore.masterId === device.id" class="master-badge">Master</span>
        <input
          v-else
          type="checkbox"
          :checked="groupControlStore.selectedSlaveIds.includes(device.id)"
          @change="groupControlStore.toggleSlave(device.id)"
          class="group-select-checkbox"
        />
      </div>
      <span v-else class="row-index-placeholder"></span>
    </div>

    <!-- Col 2: Thumbnail & hover preview -->
    <div class="cell col-thumb" @mouseenter="showPopover = true" @mouseleave="showPopover = false" @click.stop="onThumbClick">
      <div class="thumb-box">
        <img v-if="device.snapshot" :src="device.snapshot" class="thumb-img" alt="" loading="lazy" />
        <span v-else class="thumb-placeholder">📱</span>
        <span v-if="device.clientCount > 0" class="thumb-in-use-dot" title="In Use"></span>
      </div>

      <!-- Hover preview popover -->
      <transition name="fade">
        <div v-if="showPopover && device.snapshot" class="thumb-popover" @click.stop>
          <img :src="device.snapshot" class="popover-img" />
          <div class="popover-info">
            <span class="popover-id">{{ device.id }}</span>
            <span class="popover-status" :class="statusClass">{{ statusText }}</span>
          </div>
        </div>
      </transition>
    </div>

    <!-- Col 3: Device ID & Model -->
    <div class="cell col-device">
      <div class="device-primary">
        <span class="device-id-text" :title="device.id">{{ device.id }}</span>
        <span v-if="isCameraMode" class="item-camera-mode-badge" title="Device running in Camera Monitor Mode">📷 Monitoring</span>
        <span v-else-if="isWebSocketMode" class="item-ws-mode-badge" title="Device running in WebSocket Streaming Mode">⚡ Streaming</span>
      </div>
      <div class="device-secondary">
        <span v-if="device.info?.model" class="model-text" :title="device.info.model">{{ device.info.model }}</span>
        <span v-else class="model-text muted">Unknown Model</span>
        <span v-if="device.info?.displays?.[0]" class="res-text">
          ({{ device.info.displays[0].x_res }}×{{ device.info.displays[0].y_res }})
        </span>
      </div>
    </div>

    <!-- Col 4: Running Status -->
    <div class="cell col-status">
      <div class="status-pill" :class="statusClass">
        <span class="status-dot"></span>
        <span class="status-label">{{ statusText }}</span>
      </div>
      <span v-if="device.status !== 'online' && lastSeenText" class="last-seen-sub" :title="lastSeenText">
        {{ lastSeenText }}
      </span>
    </div>

    <!-- Col 5: Client Connections -->
    <div class="cell col-clients" :title="inUseTitle">
      <div v-if="device.clientCount > 0" class="client-active-pill">
        <span class="client-icon">👤</span>
        <span class="client-name">{{ clientsSummary }}</span>
      </div>
      <span v-else class="client-idle">Idle</span>
    </div>

    <!-- Col 6: Real-time monitoring metrics (CPU / Memory) -->
    <div class="cell col-metrics">
      <template v-if="device.status === 'online' && (cpuPercent !== null || memPercent !== null)">
        <div class="metric-line" :title="`CPU: ${cpuPercent}%`">
          <span class="metric-name">CPU</span>
          <div class="metric-track">
            <div class="metric-bar" :style="{ width: `${cpuPercent}%` }" :class="getMetricColorClass(cpuPercent, 70, 85)"></div>
          </div>
          <span class="metric-num">{{ cpuPercent }}%</span>
        </div>
        <div class="metric-line" :title="`Memory: ${memPercent}%`">
          <span class="metric-name">RAM</span>
          <div class="metric-track">
            <div class="metric-bar" :style="{ width: `${memPercent}%` }" :class="getMetricColorClass(memPercent, 75, 90)"></div>
          </div>
          <span class="metric-num">{{ memPercent }}%</span>
        </div>
      </template>
      <span v-else class="metric-empty">—</span>
    </div>

    <!-- Col 7: Tags -->
    <div class="cell col-tags">
      <div v-if="tags.length > 0" class="tags-container">
        <span
          v-for="tag in visibleTags"
          :key="tag.id"
          class="tag-badge"
          :style="tagStyle(tag)"
          :title="tag.name"
        >{{ tag.name }}</span>
        <span v-if="hiddenTagCount > 0" class="tag-badge more-tag">+{{ hiddenTagCount }}</span>
      </div>
      <span v-else class="no-tags">—</span>
    </div>

    <!-- Col 8: Quick actions -->
    <div class="cell col-actions" @click.stop>
      <button 
        class="action-btn primary-action" 
        @click="onRowClick" 
        :disabled="device.status !== 'online'"
        title="Control Device"
      >
        Control
      </button>

      <button 
        class="action-btn icon-action" 
        @click="onAddToMulti" 
        v-if="device.status === 'online'"
        title="Join Multi-Device"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="3" width="8" height="18" rx="2"></rect><rect x="14" y="3" width="8" height="18" rx="2"></rect></svg>
      </button>

      <button 
        class="action-btn icon-action" 
        @click="onSettings"
        title="Connection Settings"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2h-2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51-1z"></path></svg>
      </button>

      <!-- More actions menu button -->
      <button class="action-btn icon-action more-btn" @click.stop="toggleMenu" title="More Actions">
        <svg viewBox="0 0 16 16" fill="currentColor">
          <circle cx="4" cy="8" r="1.5"/>
          <circle cx="8" cy="8" r="1.5"/>
          <circle cx="12" cy="8" r="1.5"/>
        </svg>
      </button>
    </div>

    <!-- Dropdown menu -->
    <div v-if="showMenu" class="item-menu" @click.stop>
      <button class="menu-item" @click.stop="onWebSocketMirror" v-if="device.status === 'online'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
        WebSocket Streaming
      </button>
      <button class="menu-item" @click.stop="onCameraSettings" v-if="device.status === 'online'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
        Camera Monitor Mode
      </button>
      <button class="menu-item" @click.stop="onSettings">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2h.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82.33l.06.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51-1z"></path></svg>
        Connection Settings
      </button>
      <button class="menu-item" @click.stop="onShareDevice" v-if="authStore.isAdmin">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
        Share Device / Card Key
      </button>
      <button class="menu-item" @click="onEditTags">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 12v7a1 1 0 0 1-1 1h-7L4 12V5a1 1 0 0 1 1-1h7l8 8z"></path><circle cx="8.5" cy="8.5" r="1.5"></circle></svg>
        Edit Tags
      </button>
      <button class="menu-item danger" @click="onQuitAgent" :disabled="device.status !== 'online'">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v6M12 4.5a6 6 0 11-8 0"/></svg>
        Exit Agent
      </button>
      <button v-if="device.status !== 'online'" class="menu-item danger" @click="onDeleteRecord">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        Remove Record
      </button>
    </div>
    <div v-if="showMenu" class="menu-overlay" @click.stop="showMenu = false"></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useDeviceStore } from '@/stores/devices'
import { useGroupControlStore } from '@/stores/groupControl'
import { useAuthStore } from '@/stores/auth'
import { getDeviceSettings } from '@/utils/settings'

const props = defineProps({
  device: { type: Object, required: true },
  tags: { type: Array, default: () => [] }
})

const emit = defineEmits(['connect', 'settings', 'camera-settings', 'edit-tags', 'share'])
const deviceStore = useDeviceStore()
const groupControlStore = useGroupControlStore()
const authStore = useAuthStore()
const showMenu = ref(false)
const showPopover = ref(false)
const rowElement = ref(null)

const statusClass = computed(() => (props.device.status === 'online' ? 'online' : 'offline'))
const statusText = computed(() => (props.device.status === 'online' ? 'Online' : 'Offline'))

const isCameraMode = computed(() => {
  return deviceStore.getDeviceMode(props.device.id) === 'camera' && deviceStore.activeDeviceIds.includes(props.device.id)
})

const isWebSocketMode = computed(() => {
  return deviceStore.getDeviceMode(props.device.id) === 'websocket' && deviceStore.activeDeviceIds.includes(props.device.id)
})

const lastSeenText = computed(() => {
  if (!props.device.lastSeen) return ''
  const d = new Date(props.device.lastSeen)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
})

const visibleTags = computed(() => props.tags.slice(0, 2))
const hiddenTagCount = computed(() => Math.max(0, props.tags.length - visibleTags.value.length))

const clientsInfo = computed(() => props.device.clients || [])
function formatClientRemain(sec) {
  if (sec === undefined || sec === null || sec < 0) return 'Permanent'
  if (sec === 0) return 'Expired'
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (d > 0) return `${d}d left`
  if (h > 0) return `${h}h left`
  return `${Math.max(1, m)}m left`
}

const clientsSummary = computed(() => {
  const list = clientsInfo.value
  if (list.length === 0) return 'Idle'
  const c = list[0]
  const remain = formatClientRemain(c.remaining_seconds)
  const name = `${c.name} (${remain})`
  return list.length > 1 ? `${name} +${list.length - 1}` : name
})

const inUseTitle = computed(() => {
  const lines = clientsInfo.value.map(c => `${c.name}（${formatClientRemain(c.remaining_seconds)}）`)
  return lines.length ? `Current connections:\n${lines.join('\n')}` : `${props.device.clientCount || 0} active connection(s)`
})

const cpuPercent = computed(() => {
  if (!props.device.metrics || props.device.metrics.cpu === undefined) return null
  return Math.round(props.device.metrics.cpu || 0)
})

const memPercent = computed(() => {
  if (!props.device.metrics || props.device.metrics.memory_percent === undefined) return null
  return Math.round(props.device.metrics.memory_percent || 0)
})

function getMetricColorClass(val, warnThreshold, dangerThreshold) {
  if (val >= dangerThreshold) return 'danger'
  if (val >= warnThreshold) return 'warning'
  return 'normal'
}

function onRowClick() {
  if (props.device.status !== 'online') return
  if (!showMenu.value) {
    deviceStore.setDeviceMode(props.device.id, 'display')
    emit('connect', props.device.id)
  }
}

function onThumbClick() { onRowClick() }

function onAddToMulti() {
  showMenu.value = false
  deviceStore.setDeviceMode(props.device.id, 'display')
  deviceStore.openDevice(props.device.id)
}

function toggleMenu() { showMenu.value = !showMenu.value }

function onWebSocketMirror() {
  showMenu.value = false
  deviceStore.openDeviceAsWebSocket(props.device.id)
}

function onCameraSettings() {
  showMenu.value = false
  // Option A: Direct access to security monitoring screen
  deviceStore.openDeviceAsCamera(props.device.id)
}
function onSettings() {
  showMenu.value = false
  emit('settings', props.device.id)
}

function onShareDevice() {
  showMenu.value = false
  emit('share', props.device.id)
}

function onEditTags() {
  showMenu.value = false
  emit('edit-tags', props.device.id)
}

function tagStyle(tag) {
  return {
    color: tag.color,
    borderColor: `${tag.color}60`,
    background: `${tag.color}14`
  }
}

function onQuitAgent() {
  showMenu.value = false
  if (confirm(`Warning: Are you sure you want to stop the Agent on device "${props.device.id}"?`)) {
    deviceStore.quitAgent(props.device.id)
  }
}

async function onDeleteRecord() {
  showMenu.value = false
  if (confirm(`Are you sure you want to delete the offline record for "${props.device.id}"?`)) {
    try { await deviceStore.deleteOfflineDevice(props.device.id) } 
    catch (e) { alert('Failed to delete offline record: ' + (e.message || e)) }
  }
}

function onClickOutside(event) {
  if (rowElement.value && !rowElement.value.contains(event.target)) showMenu.value = false
}

onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => document.removeEventListener('click', onClickOutside))
</script>

<style scoped>
.device-table-row {
  position: relative;
  display: flex;
  align-items: center;
  padding: 6px 12px;
  background: var(--bg-card, #161b22);
  border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
  min-height: 48px;
  box-sizing: border-box;
}

.device-table-row:hover {
  background: rgba(56, 139, 253, 0.06);
}

.device-table-row.offline {
  opacity: 0.65;
}

.device-table-row.offline:hover {
  opacity: 0.9;
}

.cell {
  display: flex;
  align-items: center;
  padding: 0 6px;
  box-sizing: border-box;
  overflow: hidden;
}

/* Column widths */
.col-select {
  flex: 0 0 36px;
  justify-content: center;
}

.group-select-checkbox {
  width: 15px;
  height: 15px;
  cursor: pointer;
  accent-color: var(--accent, #388bfd);
  margin: 0;
}

.master-badge {
  font-size: 9px;
  font-weight: 800;
  color: #fff;
  background: #ff9f43;
  padding: 1px 4px;
  border-radius: 3px;
  white-space: nowrap;
}

.col-thumb {
  flex: 0 0 46px;
  justify-content: center;
  position: relative;
}

.thumb-box {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  overflow: hidden;
  background: #0d1117;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb-placeholder {
  font-size: 16px;
}

.thumb-in-use-dot {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #38bdf8;
  box-shadow: 0 0 4px #38bdf8;
}

/* Thumbnail hover Popover */
.thumb-popover {
  position: absolute;
  top: -10px;
  left: 48px;
  width: 160px;
  background: #161b22;
  border: 1px solid var(--border, rgba(255, 255, 255, 0.15));
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
  z-index: 100;
  overflow: hidden;
  pointer-events: none;
}

.popover-img {
  width: 100%;
  max-height: 240px;
  object-fit: contain;
  background: #000;
  display: block;
}

.popover-info {
  padding: 4px 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(13, 17, 23, 0.9);
}

.popover-id {
  font-size: 11px;
  font-weight: 700;
  color: #f1f5f9;
}

.popover-status {
  font-size: 10px;
  font-weight: 700;
}

.popover-status.online { color: #4ade80; }
.popover-status.offline { color: #94a3b8; }

.col-device {
  flex: 1.5 1 180px;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 2px;
  min-width: 0;
}

.device-primary {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
}

.item-camera-mode-badge {
  flex: 0 0 auto;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.35);
  font-weight: 700;
  white-space: nowrap;
}

.item-ws-mode-badge {
  flex: 0 0 auto;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(168, 85, 247, 0.18);
  color: #c084fc;
  border: 1px solid rgba(168, 85, 247, 0.38);
  font-weight: 700;
  white-space: nowrap;
}

.device-id-text {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary, #f1f5f9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.15s;
}

.device-table-row:hover .device-id-text {
  color: var(--accent, #388bfd);
}

.device-secondary {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-secondary, #94a3b8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}

.model-text {
  font-size: 11px;
}

.model-text.muted {
  opacity: 0.5;
}

.res-text {
  font-size: 10px;
  opacity: 0.6;
}

.col-status {
  flex: 0 0 95px;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 2px;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}

.status-pill.online {
  background: rgba(74, 222, 128, 0.12);
  color: #4ade80;
}

.status-pill.offline {
  background: rgba(255, 255, 255, 0.08);
  color: #94a3b8;
}

.status-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

.status-pill.online .status-dot {
  background: #4ade80;
  box-shadow: 0 0 5px #4ade80;
}

.status-pill.offline .status-dot {
  background: #64748b;
}

.last-seen-sub {
  font-size: 10px;
  color: var(--text-secondary, #94a3b8);
  opacity: 0.6;
}

.col-clients {
  flex: 1 1 120px;
  min-width: 0;
}

.client-active-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: rgba(2, 132, 199, 0.15);
  border: 1px solid rgba(2, 132, 199, 0.3);
  border-radius: 6px;
  font-size: 11px;
  color: #38bdf8;
  max-width: 100%;
}

.client-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.client-idle {
  font-size: 11px;
  color: var(--text-secondary, #94a3b8);
  opacity: 0.6;
}

.col-metrics {
  flex: 0 0 130px;
  flex-direction: column;
  gap: 3px;
  justify-content: center;
}

.metric-line {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
}

.metric-name {
  font-size: 9px;
  font-weight: 700;
  color: var(--text-secondary, #94a3b8);
  width: 24px;
}

.metric-track {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  overflow: hidden;
}

.metric-bar {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.metric-bar.normal { background: #388bfd; }
.metric-bar.warning { background: #f59e0b; }
.metric-bar.danger { background: #ef4444; }

.metric-num {
  font-size: 10px;
  font-family: monospace;
  color: var(--text-secondary, #94a3b8);
  width: 28px;
  text-align: right;
}

.metric-empty {
  font-size: 12px;
  color: var(--text-secondary, #94a3b8);
  opacity: 0.4;
}

.col-tags {
  flex: 1 1 120px;
  min-width: 0;
}

.tags-container {
  display: flex;
  gap: 4px;
  overflow: hidden;
  white-space: nowrap;
}

.tag-badge {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 6px;
  border: 1px solid;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 65px;
}

.more-tag {
  color: var(--text-secondary, #94a3b8);
  border-color: var(--border, rgba(255, 255, 255, 0.1));
  background: rgba(255, 255, 255, 0.06);
}

.no-tags {
  font-size: 12px;
  color: var(--text-secondary, #94a3b8);
  opacity: 0.4;
}

.col-actions {
  flex: 0 0 145px;
  justify-content: flex-end;
  gap: 5px;
}

.action-btn {
  height: 26px;
  padding: 0 8px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.primary-action {
  background: var(--accent, #388bfd);
  color: #fff;
  border: none;
}

.primary-action:hover:not(:disabled) {
  background: #2374e1;
  box-shadow: 0 2px 8px rgba(56, 139, 253, 0.4);
}

.primary-action:disabled {
  background: rgba(255, 255, 255, 0.08);
  color: #64748b;
  cursor: not-allowed;
}

.icon-action {
  width: 26px;
  height: 26px;
  padding: 0;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-secondary, #94a3b8);
}

.icon-action:hover {
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
}

.icon-action svg {
  width: 13px;
  height: 13px;
}

/* Dropdown menu */
.item-menu {
  position: absolute;
  top: 36px;
  right: 12px;
  min-width: 140px;
  background: #161b22;
  border: 1px solid var(--border, rgba(255, 255, 255, 0.15));
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  z-index: 100;
  padding: 4px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  background: transparent;
  border: none;
  border-radius: 5px;
  font-size: 12px;
  color: var(--text-primary, #f1f5f9);
  cursor: pointer;
  text-align: left;
}

.menu-item:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
}

.menu-item:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.menu-item.danger {
  color: #f85149;
}

.menu-item svg {
  width: 13px;
  height: 13px;
}

.menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
}

@media (max-width: 1024px) {
  .col-metrics, .col-tags {
    display: none;
  }
  .col-device {
    flex: 1;
  }
}
</style>
