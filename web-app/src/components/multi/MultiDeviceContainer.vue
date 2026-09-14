<template>
  <div class="multi-device-container">
    <!-- Global Multi Bar -->
    <header class="multi-top-bar">
      <!-- Left: Title and device badges -->
      <div class="top-bar-left">
        <div class="multi-brand">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="brand-svg">
            <rect x="2" y="3" width="8" height="18" rx="2"></rect>
            <rect x="14" y="3" width="8" height="18" rx="2"></rect>
          </svg>
          <span class="brand-title">Multi-Device</span>
          <span class="device-count-badge">{{ activeDeviceIds.length }} units</span>
        </div>

        <!-- Quick device pills -->
        <div class="quick-device-pills">
          <button 
            v-for="id in activeDeviceIds" 
            :key="id" 
            class="device-pill"
            :class="{ active: focusedDeviceId === id }"
            @click="deviceStore.focusDevice(id)"
            :title="id"
          >
            <span class="pill-dot"></span>
            <span class="pill-name">{{ id }}</span>
            <span class="pill-close" @click.stop="deviceStore.closeDevice(id)" title="Close">×</span>
          </button>

          <!-- Add device dropdown menu -->
          <div class="add-device-dropdown-container" @click.stop>
            <button class="add-device-btn" @click="showAddMenu = !showAddMenu" title="Add more devices">
              <span class="plus-icon">+</span> Add Device
            </button>

            <div v-if="showAddMenu" class="add-device-menu">
              <div class="menu-header">Select online device to add:</div>
              <div class="menu-list">
                <div 
                  v-for="dev in availableDevices" 
                  :key="dev.id"
                  class="menu-item"
                  @click="addDeviceToMulti(dev.id)"
                >
                  <span class="dev-dot online"></span>
                  <span class="dev-name">{{ dev.id }}</span>
                  <span class="dev-model" v-if="dev.info?.model">({{ dev.info.model }})</span>
                </div>
                <div v-if="availableDevices.length === 0" class="menu-empty">
                  No available online devices or all already opened
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Layout switcher & global actions -->
      <div class="top-bar-right">
        <!-- Layout mode switcher -->
        <div class="layout-mode-group">
          <button 
            class="layout-mode-btn" 
            :class="{ active: multiLayoutMode === 'grid' }"
            @click="deviceStore.setMultiLayoutMode('grid')"
            title="Grid Tiling"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            <span class="btn-lbl">Grid</span>
          </button>

          <button 
            class="layout-mode-btn" 
            :class="{ active: multiLayoutMode === 'tabs' }"
            @click="deviceStore.setMultiLayoutMode('tabs')"
            title="Tabs View"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <line x1="4" y1="9" x2="20" y2="9"></line>
            </svg>
            <span class="btn-lbl">Tabs</span>
          </button>

          <button 
            class="layout-mode-btn" 
            :class="{ active: multiLayoutMode === 'floating' }"
            @click="deviceStore.setMultiLayoutMode('floating')"
            title="Floating Workspace"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="11" height="11" rx="2"></rect>
              <path d="M9 9h12v12H9z"></path>
            </svg>
            <span class="btn-lbl">Float</span>
          </button>
        </div>

        <div class="divider-vertical"></div>

        <!-- Audio focus / mix policy -->
        <button 
          class="top-tool-btn" 
          :class="{ active: audioFocusMode === 'exclusive' }"
          @click="toggleAudioMode"
          :title="audioFocusMode === 'exclusive' ? 'Audio mode: Exclusive to focused device (click to mix all)' : 'Audio mode: Mixed audio (click for exclusive)'"
        >
          <span class="tool-icon">🔊</span>
          <span class="tool-text">{{ audioFocusMode === 'exclusive' ? 'Exclusive' : 'Mixed' }}</span>
        </button>

        <!-- Close all -->
        <button class="close-all-btn" @click="closeAll" title="Close multi-device workspace">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </header>

    <!-- Workspace main viewport -->
    <main class="multi-body-viewport">
      <MultiGridTiling v-if="multiLayoutMode === 'grid'" />
      <MultiTabsView v-else-if="multiLayoutMode === 'tabs'" />
      <MultiFloatingWorkspace v-else-if="multiLayoutMode === 'floating'" />
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useDeviceStore } from '@/stores/devices'
import MultiGridTiling from './MultiGridTiling.vue'
import MultiTabsView from './MultiTabsView.vue'
import MultiFloatingWorkspace from './MultiFloatingWorkspace.vue'

const deviceStore = useDeviceStore()
const activeDeviceIds = computed(() => deviceStore.activeDeviceIds)
const focusedDeviceId = computed(() => deviceStore.focusedDeviceId)
const multiLayoutMode = computed(() => deviceStore.multiLayoutMode)
const audioFocusMode = computed(() => deviceStore.audioFocusMode)

const showAddMenu = ref(false)

const availableDevices = computed(() => 
  deviceStore.devices.filter(d => d.status === 'online' && !activeDeviceIds.value.includes(d.id))
)

function addDeviceToMulti(id) {
  deviceStore.openDevice(id)
  showAddMenu.value = false
}

function toggleAudioMode() {
  deviceStore.audioFocusMode = deviceStore.audioFocusMode === 'exclusive' ? 'mix' : 'exclusive'
}

function closeAll() {
  deviceStore.closeAllDevices()
}

function handleGlobalClick() {
  showAddMenu.value = false
}

onMounted(() => {
  window.addEventListener('click', handleGlobalClick)
})

onUnmounted(() => {
  window.removeEventListener('click', handleGlobalClick)
})
</script>

<style scoped>
/* Note: multi-top-bar hiding rule during fullscreen is provided globally in styles/main.css */
.multi-device-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: #090d13;
  overflow: hidden;
  position: relative;
}

.multi-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #161b22;
  border-bottom: 1px solid #30363d;
  height: 44px;
  padding: 0 12px;
  flex-shrink: 0;
  user-select: none;
  z-index: 10;
}

.top-bar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  overflow: hidden;
  flex: 1;
}

.multi-brand {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #38bdf8;
  font-weight: bold;
  font-size: 13px;
  flex-shrink: 0;
}

.brand-svg {
  width: 16px;
  height: 16px;
}

.device-count-badge {
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
  border-radius: 10px;
  padding: 1px 6px;
  font-size: 11px;
}

.quick-device-pills {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
}
.quick-device-pills::-webkit-scrollbar {
  display: none;
}

.device-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #0d1117;
  border: 1px solid #30363d;
  color: #c9d1d9;
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.device-pill:hover {
  background: #21262d;
  border-color: #58a6ff;
}

.device-pill.active {
  background: rgba(56, 189, 248, 0.15);
  border-color: #38bdf8;
  color: #38bdf8;
  font-weight: 600;
}

.device-pill.is-master {
  border-color: #f59e0b;
}

.pill-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #2ea043;
}

.pill-crown {
  font-size: 10px;
}

.pill-close {
  font-size: 12px;
  color: #8b949e;
  margin-left: 2px;
  border-radius: 50%;
  width: 14px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.pill-close:hover {
  background: rgba(248, 81, 73, 0.2);
  color: #f85149;
}

.add-device-dropdown-container {
  position: relative;
}

.add-device-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #21262d;
  border: 1px dashed #38bdf8;
  color: #38bdf8;
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}

.add-device-btn:hover {
  background: rgba(56, 189, 248, 0.15);
}

.add-device-menu {
  position: absolute;
  top: 32px;
  left: 0;
  width: 240px;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  padding: 6px 0;
  z-index: 50;
}

.menu-header {
  padding: 6px 10px;
  font-size: 11px;
  color: #8b949e;
  border-bottom: 1px solid #21262d;
}

.menu-list {
  max-height: 220px;
  overflow-y: auto;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  font-size: 11px;
  color: #c9d1d9;
  cursor: pointer;
}

.menu-item:hover {
  background: #21262d;
  color: #58a6ff;
}

.dev-dot.online {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #2ea043;
}

.dev-model {
  font-size: 10px;
  color: #8b949e;
}

.menu-empty {
  padding: 12px;
  text-align: center;
  font-size: 11px;
  color: #6e7681;
}

.top-bar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.layout-mode-group {
  display: flex;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 2px;
  gap: 2px;
}

.layout-mode-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: none;
  color: #8b949e;
  padding: 3px 6px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}

.layout-mode-btn svg {
  width: 12px;
  height: 12px;
}

.layout-mode-btn:hover {
  color: #c9d1d9;
}

.layout-mode-btn.active {
  background: #21262d;
  color: #38bdf8;
  font-weight: 600;
}

.divider-vertical {
  width: 1px;
  height: 20px;
  background: #30363d;
}

.top-tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #21262d;
  border: 1px solid #30363d;
  color: #c9d1d9;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}

.top-tool-btn:hover {
  background: #30363d;
}

.top-tool-btn.active {
  border-color: #38bdf8;
  color: #38bdf8;
}

.batch-dropdown-container {
  position: relative;
}

.batch-menu {
  position: absolute;
  top: 32px;
  right: 0;
  width: 200px;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  padding: 4px 0;
  z-index: 50;
}

.batch-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  font-size: 11px;
  color: #c9d1d9;
  cursor: pointer;
}

.batch-menu-item:hover {
  background: #21262d;
  color: #58a6ff;
}

.batch-menu-item.danger:hover {
  background: rgba(248, 81, 73, 0.2);
  color: #f85149;
}

.batch-menu-divider {
  height: 1px;
  background: #21262d;
  margin: 4px 0;
}

.close-all-btn {
  background: transparent;
  border: none;
  color: #8b949e;
  border-radius: 6px;
  padding: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.close-all-btn svg {
  width: 16px;
  height: 16px;
}

.close-all-btn:hover {
  background: rgba(248, 81, 73, 0.2);
  color: #f85149;
}

.multi-body-viewport {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
  position: relative;
}
</style>
