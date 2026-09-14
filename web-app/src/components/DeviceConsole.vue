<template>
  <div ref="consoleMainRef" class="device-console" :class="{ 'is-maximized': isMaximized }" :style="{ height: isMaximized ? '100vh' : height }">
    <!-- Top resize handle -->
    <div class="console-resizer" v-if="!isMaximized" @mousedown="startResizingConsole" title="Drag to resize console height"></div>

    <!-- Top Tab navigation -->
    <header class="console-tabs-bar">
      <div class="tabs-group">
        <button 
          :class="{ active: activeTab === 'shell' }" 
          @click="activeTab = 'shell'"
          title="ADB Shell Command Mode"
        >
          <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
          Terminal (Shell)
        </button>
        <button 
          :class="{ active: activeTab === 'adb' }" 
          @click="activeTab = 'adb'"
          title="ADB Interactive Terminal (xterm.js)"
        >
          <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect><path d="M12 18h.01"></path></svg>
          ADB Debug
        </button>
        <button 
          :class="{ active: activeTab === 'ai' }" 
          @click="activeTab = 'ai'"
          title="AI Troubleshooting Assistant"
        >
          <svg class="tab-icon ai-spin-hover" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path></svg>
          AI Assistant
          <span class="beta-badge">Agent</span>
        </button>
      </div>
      
      <!-- Device status indicator & console controls -->
      <div class="console-right-tools">
        <div class="console-device-badge" v-if="deviceId">
          <span class="status-indicator" :class="statusClass"></span>
          <select 
            :value="deviceId" 
            @change="onDeviceSelectChange"
            class="device-selector-dropdown"
          >
            <option 
              v-for="d in deviceStore.devices" 
              :key="d.id" 
              :value="d.id"
            >
              {{ d.id }}{{ d.status === 'online' ? '' : ' (Offline)' }}
            </option>
          </select>
        </div>
        
        <!-- Fullscreen maximize button -->
        <button 
          class="console-tool-btn" 
          @click="toggleMaximize" 
          :title="isMaximized ? 'Restore window' : 'Fullscreen'"
        >
          <svg v-if="!isMaximized" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 14h6v6m10-6h-6v6M4 10h6V4m10 6h-6V4"></path>
          </svg>
        </button>

        <!-- Minimize button (keep connected) -->
        <button class="console-tool-btn" @click="deviceStore.closeGlobalConsole()" title="Minimize console (terminal runs in background)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>

        <!-- Close button -->
        <button class="console-close-btn" @click="deviceStore.destroyGlobalConsole()" title="Close console (disconnect all sessions)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </header>

    <!-- Tab content area -->
    <div class="console-tab-content">
      <!-- 1. Shell View -->
      <div v-show="activeTab === 'shell'" class="shell-tab-panel">
        <div class="console-history" ref="consoleRef">
          <div v-for="(log, idx) in consoleLogs" :key="idx" :class="['log-item', log.type]">
            <template v-if="log.type === 'batch_result'">
              <span class="log-cmd">$ [Batch] {{ log.cmd }} (Sent to {{ Object.keys(log.results).length }} devices)</span>
              <div class="batch-outputs-list">
                <div 
                  v-for="(res, devId) in log.results" 
                  :key="devId" 
                  class="batch-output-row"
                  :class="res.status"
                >
                  <div class="row-header">
                    <span class="dev-tag">[{{ devId }}]</span>
                    <span class="status-tag" :class="res.status">
                      {{ res.status === 'running' ? '⏳ Running' : (res.status === 'success' ? '✅ Success' : '❌ Failed') }}
                    </span>
                  </div>
                  <pre class="dev-output">{{ res.output }}</pre>
                </div>
              </div>
            </template>
            <template v-else>
              <span class="log-cmd" v-if="log.cmd">$ {{ log.cmd }}</span>
              <pre class="log-out">{{ log.text }}</pre>
            </template>
          </div>
          <div v-if="consoleLogs.length === 0" class="console-empty">
            <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            Waiting for command dispatch...
          </div>
        </div>
        <div class="console-shortcuts">
          <button 
            v-for="(item, idx) in consoleShortcuts" 
            :key="idx" 
            @click="quickCmd(item.cmd)"
          >
            {{ item.name }}
          </button>
          <button @click="consoleLogs = []" class="system-btn">Clear</button>
          <button @click="showShortcutModal = true" class="system-btn edit-btn">⚙️ Customize</button>
        </div>

        <!-- Concurrent target device selector -->
        <div class="shell-targets-bar">
          <div class="targets-control-row">
            <span class="label">Targets: </span>
            <label class="select-all-check" v-if="deviceStore.devices.filter(dev => dev.status === 'online' && dev.id !== deviceId).length > 0">
              <input type="checkbox" v-model="isAllDevicesSelected" />
              <span class="checkbox-custom"></span>
              <span class="name">All</span>
            </label>
            <div class="tag-filters" v-if="tagStore.tags.length > 0">
              <span class="tag-filter-label">By Tag: </span>
              <button 
                v-for="tag in tagStore.tags" 
                :key="tag.id" 
                class="tag-filter-btn"
                :style="{ 
                  borderColor: tag.color,
                  backgroundColor: isTagAllSelected(tag.id) ? tag.color : 'transparent',
                  color: isTagAllSelected(tag.id) ? '#fff' : tag.color 
                }"
                @click="toggleTagDevices(tag.id)"
              >
                {{ tag.name }}
              </button>
            </div>
          </div>
          <div class="targets-list">
            <label class="target-check current">
              <input type="checkbox" checked disabled />
              <span class="checkbox-custom"></span>
              <span class="name">{{ deviceId }} (Current)</span>
            </label>
            <label 
              v-for="d in deviceStore.devices.filter(dev => dev.status === 'online' && dev.id !== deviceId)" 
              :key="d.id" 
              class="target-check"
            >
              <input type="checkbox" :value="d.id" v-model="batchShellSelectedIds" />
              <span class="checkbox-custom"></span>
              <span class="name">{{ d.id }}</span>
            </label>
          </div>
        </div>

        <div class="console-input-group">
          <input 
            v-model="inputCmd" 
            @keyup.enter="execCmd"
            @keydown.up.prevent="navigateHistory('up')"
            @keydown.down.prevent="navigateHistory('down')"
            placeholder="Enter Android Shell command to dispatch..."
            class="cmd-input"
          />
          <button @click="execCmd" class="send-btn" :disabled="!inputCmd.trim()">{{ sendBtnText }}</button>
        </div>
      </div>

      <!-- 2. ADB Interactive Terminal (xterm.js) -->
      <div v-show="activeTab === 'adb'" class="adb-tab-panel">
        <!-- Terminal session tabs -->
        <div class="adb-sessions-bar" v-if="adbSessions.length > 0">
          <div class="adb-tabs-group">
            <button 
              v-for="sess in adbSessions" 
              :key="sess.id"
              :class="{ active: activeSessionId === sess.id }"
              @click="switchAdbSession(sess.id)"
              class="adb-session-tab"
            >
              <span class="tab-status-dot" :class="{ connected: sess.isConnected }"></span>
              <span class="sess-name">{{ sess.name }}</span>
              <span class="close-sess-btn" @click.stop="closeAdbSession(sess.id)" title="Close session">×</span>
            </button>
            <button 
              class="add-sess-btn" 
              @click="addAdbSession" 
              title="New terminal session" 
              :disabled="adbSessions.length >= 5"
            >
              +
            </button>
          </div>
          <span class="max-sess-tip">Up to 5 terminal sessions supported</span>
        </div>

        <div v-if="adbSessions.length === 0" class="adb-placeholder">
          <svg class="adb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><polyline points="9 9 9 15 12 12 15 15 15 9"></polyline></svg>
          <h3>Open Interactive ADB Web Terminal</h3>
          <p>Direct WebRTC P2P encrypted channel with Tab completion and multi-session debugging</p>
          <button class="adb-connect-btn" @click="addAdbSession" :disabled="webrtcStatus !== 'connected'">Initialize ADB Terminal</button>
        </div>

        <!-- Terminal containers for sessions -->
        <div 
          v-for="sess in adbSessions" 
          :key="sess.id"
          :ref="el => { if (el) sessionContainers[sess.id] = el }"
          class="xterm-view-container" 
          v-show="activeSessionId === sess.id"
        ></div>
      </div>

      <!-- 3. AI Assistant (AI Agent) -->
      <div v-show="activeTab === 'ai'" class="ai-tab-panel">
        <!-- Quick skill templates sidebar -->
        <aside class="ai-skills-sidebar">
          <div class="sidebar-header">
            <h4>🤖 Quick Skill Templates</h4>
            <button class="add-skill-btn" @click="addNewSkillPrompt" title="New custom skill">+</button>
          </div>
          <div class="skills-list">
            <button 
              v-for="(skill, idx) in allSkills" 
              :key="idx" 
              class="skill-item"
              @click="runSkill(skill)"
              :title="skill.desc"
              :disabled="aiLoading"
            >
              <span class="skill-name">{{ skill.name }}</span>
              <span class="skill-desc">{{ skill.desc }}</span>
              <span class="skill-delete" @click.stop="deleteSkill(idx)" v-if="skill.isCustom">×</span>
            </button>
          </div>
        </aside>

        <!-- AI Chat and log area -->
        <div class="ai-main-chat">
          <!-- Top settings and config -->
          <div class="ai-config-header">
            <button class="ai-settings-toggle" @click="showAiSettings = !showAiSettings">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              AI Connection Settings {{ showAiSettings ? '▲' : '▼' }}
            </button>
            <span class="ai-model-badge">{{ aiModel }}</span>
          </div>

          <transition name="slide">
            <div class="ai-settings-panel" v-if="showAiSettings">
              <div class="form-row">
                <label>API Base URL:</label>
                <input v-model="aiUrl" placeholder="e.g. https://api.openai.com/v1" />
              </div>
              <div class="form-row">
                <label>API Key / Token:</label>
                <div class="password-input-wrapper">
                  <input v-model="aiKey" :type="showAiKey ? 'text' : 'password'" placeholder="Enter your API Key (Token)" />
                  <button type="button" class="eye-toggle-btn" @click="showAiKey = !showAiKey" :title="showAiKey ? 'Hide' : 'Show'">
                    <svg v-if="showAiKey" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  </button>
                </div>
              </div>
              <div class="form-row">
                <label>Model:</label>
                <input v-model="aiModel" placeholder="e.g. gpt-4o-mini or deepseek-chat" />
              </div>
              <div class="form-row">
                <label>Provider:</label>
                <select v-model="aiProvider">
                  <option value="openai">OpenAI</option>
                  <option value="zhipu">Zhipu AI</option>
                  <option value="claude">Claude</option>
                </select>
              </div>
              <div class="form-actions">
                <button class="save-settings-btn" @click="saveAiSettings">Save Settings</button>
              </div>
            </div>
          </transition>

          <!-- AI Execution trace logs -->
          <div class="ai-trace-panel" v-if="aiLogs.length > 0">
            <div class="trace-header">
              <span>⚡ AI Agent Thought Process & Tool Execution Logs</span>
              <button class="clear-trace-btn" @click="aiLogs = []">Clear</button>
            </div>
            <div class="trace-body">
              <div v-for="(log, idx) in aiLogs" :key="idx" class="trace-log-line">
                <span class="trace-time">{{ formatTime(log.time) }}</span>
                <span :class="['trace-text', log.type]">{{ log.text }}</span>
              </div>
            </div>
          </div>

          <!-- Chat history -->
          <div class="ai-chat-history" ref="chatRef">
            <div v-if="aiMessages.length === 0" class="chat-empty">
              <h3>🤖 Cloud Phone AI Assistant</h3>
              <p>Configure your API Key and choose a diagnostic skill or ask a question directly.<br/>I can run ADB commands to diagnose network latency, analyze app crashes, and perform device maintenance.</p>
            </div>
            <div 
              v-for="(msg, idx) in visibleMessages" 
              :key="idx" 
              :class="['chat-bubble-wrapper', msg.role]"
            >
              <div class="chat-bubble">
                <div class="bubble-header">
                  <span class="sender-name">{{ msg.role === 'user' ? 'User' : 'AI Assistant' }}</span>
                </div>
                <div class="bubble-content">
                  <pre class="formatted-text" v-if="msg.content">{{ msg.content }}</pre>
                  <div class="tool-calls-display" v-if="msg.tool_calls">
                    <div v-for="tc in msg.tool_calls" :key="tc.id" class="tool-badge">
                      🛠️ Calling tool: {{ tc.function.name }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="aiLoading" class="chat-bubble-wrapper assistant loading-state">
              <div class="chat-bubble">
                <div class="loading-dots">
                  <span></span><span></span><span></span>
                </div>
                <div class="loading-tip">AI Agent is thinking or executing ADB commands...</div>
              </div>
            </div>
          </div>

          <!-- Input area -->
          <div class="ai-input-group">
            <textarea 
              v-model="aiInput" 
              @keydown.enter.exact.prevent="sendAiMessage"
              placeholder="Ask a question, e.g. 'Check disk space and identify large files'..."
              class="ai-chat-input"
              rows="2"
              :disabled="aiLoading"
            ></textarea>
            <button 
              class="ai-send-btn" 
              @click="sendAiMessage"
              :disabled="!aiInput.trim() || aiLoading"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Hidden dummy video for headless WebRTC -->
    <video ref="dummyVideo" style="display: none;" autoplay playsinline muted></video>

    <!-- Custom quick commands modal -->
    <div v-if="showShortcutModal" class="shortcut-modal-overlay" @click.self="showShortcutModal = false">
      <div class="shortcut-modal-card">
        <div class="modal-header">
          <h3>Customize Quick Commands</h3>
          <button class="close-btn" @click="showShortcutModal = false">✕</button>
        </div>
        <div class="modal-body custom-scrollbar">
          <div class="shortcut-list">
            <div v-for="(item, idx) in modalShortcuts" :key="idx" class="shortcut-item-row">
              <div class="input-col name-col">
                <label>Name</label>
                <input v-model="item.name" placeholder="Enter name, e.g. Model" />
              </div>
              <div class="input-col cmd-col">
                <label>Shell Command</label>
                <input v-model="item.cmd" placeholder="Enter Shell command, e.g. getprop ro.product.model" />
              </div>
              <button class="delete-btn" @click="deleteModalShortcut(idx)" title="Delete command">✕</button>
            </div>
            <div v-if="modalShortcuts.length === 0" class="no-shortcuts">
              No custom quick commands
            </div>
          </div>
          <button class="add-row-btn" @click="addModalShortcut">+ Add Command</button>
        </div>
        <div class="modal-footer">
          <button class="btn btn-reset" @click="resetToDefaultShortcuts">Restore Defaults</button>
          <div class="footer-actions">
            <button class="btn btn-cancel" @click="showShortcutModal = false">Cancel</button>
            <button class="btn btn-save" @click="saveShortcuts">Save</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useDeviceStore } from '@/stores/devices'
import { useAuthStore } from '@/stores/auth'
import { useTagStore } from '@/stores/tags'
import { useAdb } from '@/composables/useAdb'
import { useWebRTC } from '@/composables/useWebRTC'
import { getDeviceSettings } from '@/utils/settings'

const props = defineProps({
  deviceId: {
    type: String,
    required: true
  },
  isDrawer: {
    type: Boolean,
    default: false
  },
  height: {
    type: String,
    default: '100%'
  },
  shareToken: {
    type: String,
    default: ''
  },
  sharePassword: {
    type: String,
    default: ''
  },
  accessMode: {
    type: String,
    default: 'full'
  }
})

const emit = defineEmits(['close'])

const deviceStore = useDeviceStore()
const authStore = useAuthStore()
const tagStore = useTagStore()
const dummyVideo = ref(null)
const consoleRef = ref(null)
const chatRef = ref(null)

const showAiKey = ref(false)
const activeTab = ref('shell')
const consoleLogs = ref([])
const inputCmd = ref('')

// Watch AI Tab activation, establish command channel on demand
watch(activeTab, (newTab) => {
  if (newTab === 'ai') {
    if (webrtc.value && typeof webrtc.value.createAiCommandChannel === 'function') {
      webrtc.value.createAiCommandChannel()
    }
  }
})

// --- Batch Shell & Single Device Integrated State ---
const batchShellSelectedIds = ref([])

const defaultShortcuts = [
  { name: '3rd-Party Apps', cmd: 'pm list packages -3' },
  { name: 'Model Info', cmd: 'getprop ro.product.model' },
  { name: 'Current Window', cmd: 'dumpsys window | grep mCurrentFocus | grep -v null' },
  { name: 'Disk Space', cmd: 'df -h /data' },
  { name: 'Show Pointer', cmd: 'settings put system pointer_location 1' },
  { name: 'Hide Pointer', cmd: 'settings put system pointer_location 0' }
]

const consoleShortcuts = ref([])
const showShortcutModal = ref(false)
const modalShortcuts = ref([])

async function loadShortcuts() {
  try {
    const token = localStorage.getItem('auth_token') || ''
    const res = await fetch('/api/shortcuts', {
      headers: {
        'Authorization': token ? `Bearer ${token}` : ''
      }
    })
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        consoleShortcuts.value = data
        try {
          localStorage.setItem('cloudphone_console_shortcuts', JSON.stringify(data))
        } catch (e) {}
        return
      }
    }
  } catch (e) {
    print("[Shortcuts] Failed to load from server, fallback to local:", e)
  }

  const saved = localStorage.getItem('cloudphone_console_shortcuts')
  if (saved) {
    try {
      consoleShortcuts.value = JSON.parse(saved)
    } catch (e) {
      consoleShortcuts.value = [...defaultShortcuts]
    }
  } else {
    consoleShortcuts.value = [...defaultShortcuts]
  }
}

async function saveShortcuts() {
  const filtered = modalShortcuts.value.filter(item => item.name.trim() && item.cmd.trim())
  consoleShortcuts.value = filtered
  
  try {
    localStorage.setItem('cloudphone_console_shortcuts', JSON.stringify(filtered))
  } catch (e) {}

  try {
    const token = localStorage.getItem('auth_token') || ''
    const res = await fetch('/api/shortcuts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify(filtered)
    })
    if (!res.ok) {
      print("[Shortcuts] Failed to sync shortcuts to server")
    }
  } catch (e) {
    print("[Shortcuts] Failed to sync shortcuts to server:", e)
  }

  showShortcutModal.value = false
}

function addModalShortcut() {
  modalShortcuts.value.push({ name: '', cmd: '' })
}

function deleteModalShortcut(idx) {
  modalShortcuts.value.splice(idx, 1)
}

function resetToDefaultShortcuts() {
  modalShortcuts.value = defaultShortcuts.map(item => ({ ...item }))
}

watch(showShortcutModal, (newVal) => {
  if (newVal) {
    modalShortcuts.value = consoleShortcuts.value.map(item => ({ ...item }))
  }
})

const isAllDevicesSelected = computed({
  get() {
    const onlineOthers = deviceStore.devices.filter(dev => dev.status === 'online' && dev.id !== props.deviceId)
    if (onlineOthers.length === 0) return false
    return onlineOthers.every(dev => batchShellSelectedIds.value.includes(dev.id))
  },
  set(val) {
    const onlineOthers = deviceStore.devices.filter(dev => dev.status === 'online' && dev.id !== props.deviceId)
    if (val) {
      batchShellSelectedIds.value = onlineOthers.map(dev => dev.id)
    } else {
      batchShellSelectedIds.value = []
    }
  }
})

function getOnlineDevicesByTag(tagId) {
  return deviceStore.devices.filter(dev => {
    if (dev.status !== 'online' || dev.id === props.deviceId) return false
    const devTags = tagStore.deviceTags[dev.id] || []
    return devTags.includes(tagId)
  })
}

function isTagAllSelected(tagId) {
  const devs = getOnlineDevicesByTag(tagId)
  if (devs.length === 0) return false
  return devs.every(dev => batchShellSelectedIds.value.includes(dev.id))
}

function toggleTagDevices(tagId) {
  const devs = getOnlineDevicesByTag(tagId)
  if (devs.length === 0) return
  
  if (isTagAllSelected(tagId)) {
    const devIds = devs.map(d => d.id)
    batchShellSelectedIds.value = batchShellSelectedIds.value.filter(id => !devIds.includes(id))
  } else {
    const newIds = new Set(batchShellSelectedIds.value)
    devs.forEach(d => newIds.add(d.id))
    batchShellSelectedIds.value = Array.from(newIds)
  }
}
const targetDeviceIds = computed(() => [props.deviceId, ...batchShellSelectedIds.value])
const sendBtnText = computed(() => targetDeviceIds.value.length > 1 ? `Send (${targetDeviceIds.value.length} devices)` : 'Send')

// Watch device changes to prevent duplicates in batchShellSelectedIds
watch(() => props.deviceId, (newId) => {
  if (newId) {
    batchShellSelectedIds.value = batchShellSelectedIds.value.filter(id => id !== newId)
  }
})

// Watch store task progress and update consoleLogs
watch(() => deviceStore.currentTask, (newTask) => {
  if (newTask && newTask.type === 'shell') {
    const logItem = consoleLogs.value.find(item => item.type === 'batch_result' && item.taskId === newTask.task_id)
    if (logItem) {
      Object.entries(newTask.devices).forEach(([devId, info]) => {
        logItem.results[devId] = {
          status: info.status,
          output: info.result || (info.status === 'running' ? 'Running...' : 'No output')
        }
      })
    }
  }
}, { deep: true })

// WebRTC status binding
const webrtc = ref(null)
const isSharedConnection = ref(false)
const webrtcConnecting = ref(false)
const webrtcStatus = ref('disconnected')
const webrtcError = ref(null)

// Multi-terminal tabs & fullscreen states
const adbSessions = ref([])
const activeSessionId = ref(null)
const nextSessionId = ref(1)
const sessionContainers = {}
const isMaximized = ref(false)
const consoleMainRef = ref(null)

const isAdbConnected = computed(() => {
  if (activeSessionId.value === null) return false
  const sess = adbSessions.value.find(s => s.id === activeSessionId.value)
  return sess ? sess.isConnected : false
})

function onDeviceSelectChange(e) {
  const newId = e.target.value
  if (newId) {
    deviceStore.openGlobalConsole(newId)
  }
}

let unwatchStatus = null
let unwatchError = null

// Safe localStorage helper
const safeStorageGet = (key, fallback = '') => {
  try {
    return localStorage.getItem(key) || fallback
  } catch (e) {
    return fallback
  }
}

const safeStorageSet = (key, val) => {
  try {
    localStorage.setItem(key, val)
  } catch (e) {
    console.warn('[Console] Failed to save to localStorage:', e)
  }
}

// AI config & state
const aiUrl = ref(safeStorageGet('ai_api_url', 'https://api.openai.com/v1'))
const aiKey = ref(safeStorageGet('ai_api_key', ''))
const aiModel = ref(safeStorageGet('ai_model', 'gpt-4o-mini'))
const aiProvider = ref(safeStorageGet('ai_provider', 'openai'))
const showAiSettings = ref(false)
const aiInput = ref('')
const aiMessages = ref([])
const aiLoading = ref(false)
const aiLogs = ref([])

// Preset skill templates
const defaultSkills = [
  { name: '📊 System Health Check', desc: 'Diagnose CPU, available RAM, and disk space', prompt: 'Please perform a comprehensive health inspection on this device: check system load (uptime/top), available memory (free), and storage space (df -h /data).' },
  { name: '📶 Network Link Analysis', desc: 'Diagnose WebRTC bitrate and round trip latency', prompt: 'Please get current WebRTC transmission quality metrics (get_webrtc_stats), analyze FPS and latency (RTT/JitterBuffer), and provide an evaluation in English.' },
  { name: '🔍 Analyze Crashes', desc: 'Retrieve logcat to search recent errors', prompt: 'Retrieve the last 100 lines of logcat error logs, check for process crashes or exceptions, and summarize the root cause.' },
  { name: '🧹 Clean System Cache', desc: 'Scan and clear temporary app caches', prompt: 'Check disk storage space. Clean temporary junk or cache directories if any, and compare the free storage before and after.' },
  { name: '🔧 Diagnose Connection & Network', desc: 'Analyze WebRTC, UDS sockets, and network congestion', prompt: 'Please assist in diagnosing connection failure, black screen, or timeout issues. Read the last 200 lines of /data/local/tmp/cloudphone-agent.log and evaluate:\n1. Startup parameters: Check if \"No external NAT mappings configured\" exists. If so, indicate that -external-addr or CP_AGENT_EXTERNAL_ADDR is missing.\n2. Network environment: Analyze ICE candidates from both ends, checking if only private Docker IPs (172.17.x.x) or proxy virtual gateways (198.18.x.x) were gathered.\n3. WebRTC & UDS channel status: Check ICEConnectionState trends and verify Video/Control/Touch UDS sockets.\n4. Frame rendering: Check if CoreService exited unexpectedly or if KeyframeTrace shows repeated errors.\nProvide a clear and professional diagnostic report and actionable recommendations in English.' }
]

const getCustomSkills = () => {
  try {
    return JSON.parse(safeStorageGet('ai_custom_skills', '[]'))
  } catch (e) {
    return []
  }
}
const customSkills = ref(getCustomSkills())

const allSkills = computed(() => {
  return [
    ...defaultSkills,
    ...customSkills.value.map(s => ({ ...s, isCustom: true }))
  ]
})

const visibleMessages = computed(() => {
  // Only display user & assistant text messages, filter intermediate tool messages
  return aiMessages.value.filter(m => m.role === 'user' || (m.role === 'assistant' && (m.content || m.tool_calls)))
})

const statusText = computed(() => {
  if (webrtcError.value) return 'Error'
  if (webrtcStatus.value === 'connected') return 'Online'
  if (webrtcStatus.value === 'connecting') return 'Connecting'
  return 'Disconnected'
})

const statusClass = computed(() => {
  return {
    connected: webrtcStatus.value === 'connected' && !webrtcError.value,
    connecting: webrtcStatus.value === 'connecting' && !webrtcError.value,
    disconnected: webrtcStatus.value === 'disconnected' || !!webrtcError.value,
    error: !!webrtcError.value
  }
})

// Initialization and connection management
async function setupDeviceConnection(deviceId) {
  if (!deviceId) return
  
  cleanupConnection()
  webrtcConnecting.value = true
  webrtcError.value = null
  
  // Check for existing active WebRTC instance
  let activeInstance = deviceStore.getWebRTC(deviceId)
  if (activeInstance) {
    console.log('[Console] Reusing active WebRTC session for device:', deviceId)
  }
  
  if (activeInstance) {
    webrtc.value = activeInstance
    isSharedConnection.value = true
    webrtcStatus.value = webrtc.value.status.value || 'connected'
    webrtcError.value = webrtc.value.error?.value || null
    webrtcConnecting.value = false
    
    // Watch WebRTC status changes
    unwatchStatus = watch(() => webrtc.value.status.value, (newStatus) => {
      webrtcStatus.value = newStatus || 'connected'
    }, { immediate: true })

    unwatchError = watch(() => webrtc.value.error?.value, (newErr) => {
      webrtcError.value = newErr || null
    }, { immediate: true })
    
    // Setup command result listener
    webrtc.value.onCommandResult(onCommandResultHandler)
  } else {
    // Create headless WebRTC connection bound to dummyVideo
    console.log('[Console] Connecting WebRTC (headless) for device:', deviceId)
    webrtcStatus.value = 'connecting'
    isSharedConnection.value = false
    try {
      const settings = getDeviceSettings(deviceId)
      const scrcpyOptions = {
        max_fps: settings.fps,
        max_size: settings.size,
        bitrate: settings.bitrate * 1000000,
        min_bitrate: settings.minBitrate * 1000000,
        max_bitrate: settings.maxBitrate * 1000000,
        bwe: settings.bwe,
        audio: settings.audio,
        audio_gain: settings.audioGain,
        audio_source: settings.audioSource,
        audio_dup: settings.audioDup,
        audio_low_latency: settings.audioLowLatency,
        debug: settings.debug,
        snapshot_interval: settings.snapshotInterval,
        power_off: settings.powerOff,
        video_source: settings.videoSource,
        camera_facing: settings.cameraFacing,
        camera_id: settings.cameraId,
        camera_size: settings.cameraSize,
        camera_fps: settings.cameraFps,
        camera_high_speed: settings.cameraHighSpeed,
        camera_ar: settings.cameraAr,
        // Read-only share: block all input injection
        view_only: props.accessMode === 'view_only'
      }

      webrtc.value = useWebRTC(deviceId, scrcpyOptions)
      
      unwatchStatus = watch(() => webrtc.value.status.value, (newStatus) => {
        webrtcStatus.value = newStatus || 'disconnected'
        if (newStatus === 'connected') {
          webrtcConnecting.value = false
        } else if (newStatus === 'failed' || newStatus === 'disconnected') {
          webrtcConnecting.value = false
        }
      }, { immediate: true })

      unwatchError = watch(() => webrtc.value.error?.value, (newErr) => {
        webrtcError.value = newErr || null
      }, { immediate: true })

      setTimeout(() => {
        if (webrtc.value && dummyVideo.value) {
          webrtc.value.setVideoGetter(() => dummyVideo.value)
          webrtc.value.connect(props.shareToken, props.sharePassword)
          webrtc.value.onCommandResult(onCommandResultHandler)
        }
      }, 50)
    } catch (e) {
      console.error('[Console] Failed to connect device:', e)
      webrtcStatus.value = 'disconnected'
      webrtcError.value = e.message || 'Initialization failed'
      webrtcConnecting.value = false
    }
  }
}

function onCommandResultHandler(res) {
  const output = res.stdout || res.stderr || (res.exit_code === 0 ? '[Success]' : `[Failed] ExitCode: ${res.exit_code}`)
  consoleLogs.value.push({
    type: res.exit_code === 0 ? 'success' : 'error',
    text: output
  })
  scrollToBottom()
}

function cleanupConnection() {
  closeAdb()
  
  isAdbConnected.value = false
  webrtcStatus.value = 'disconnected'
  webrtcError.value = null
  
  if (unwatchStatus) unwatchStatus()
  if (unwatchError) unwatchError()
  
  if (webrtc.value) {
    webrtc.value.onCommandResult(null)
    if (!isSharedConnection.value) {
      console.log('[Console] Disconnecting custom headless connection')
      try { webrtc.value.disconnect() } catch (e) {}
    }
  }
  webrtc.value = null
}

// --- Command history helper ---
const cmdHistory = ref([])
const historyIndex = ref(-1)
let tempInput = ''

try {
  const saved = localStorage.getItem('cloudphone_shell_history')
  if (saved) {
    cmdHistory.value = JSON.parse(saved)
  }
} catch (e) {}

function navigateHistory(direction) {
  if (cmdHistory.value.length === 0) return
  
  if (direction === 'up') {
    if (historyIndex.value === -1) {
      tempInput = inputCmd.value
      historyIndex.value = cmdHistory.value.length - 1
    } else if (historyIndex.value > 0) {
      historyIndex.value--
    }
    inputCmd.value = cmdHistory.value[historyIndex.value]
  } else if (direction === 'down') {
    if (historyIndex.value === -1) return
    if (historyIndex.value === cmdHistory.value.length - 1) {
      historyIndex.value = -1
      inputCmd.value = tempInput
    } else {
      historyIndex.value++
      inputCmd.value = cmdHistory.value[historyIndex.value]
    }
  }
}

// Terminal command dispatch
async function execCmd() {
  if (!inputCmd.value.trim()) return
  const cmd = inputCmd.value.trim()
  
  // Push command to history
  if (cmd) {
    if (cmdHistory.value.length === 0 || cmdHistory.value[cmdHistory.value.length - 1] !== cmd) {
      cmdHistory.value.push(cmd)
      if (cmdHistory.value.length > 100) {
        cmdHistory.value.shift()
      }
      try {
        localStorage.setItem('cloudphone_shell_history', JSON.stringify(cmdHistory.value))
      } catch (e) {}
    }
  }
  historyIndex.value = -1
  tempInput = ''

  inputCmd.value = ''

  const targets = targetDeviceIds.value

  if (targets.length === 1) {
    // Single device: native WebRTC real-time channel
    if (!webrtc.value) {
      consoleLogs.value.push({ type: 'error', text: 'WebRTC not ready, cannot send command.' })
      scrollToBottom()
      return
    }
    consoleLogs.value.push({ type: 'info', cmd: cmd, text: 'Executing...' })
    webrtc.value.sendCommand(cmd)
    scrollToBottom()
  } else {
    // Multiple devices: batch HTTP task dispatch
    const logItem = ref({
      type: 'batch_result',
      cmd: cmd,
      taskId: '',
      results: {}
    })
    
    // Initialize all target devices status
    targets.forEach(id => {
      logItem.value.results[id] = { status: 'running', output: 'Pending...' }
    })
    
    consoleLogs.value.push(logItem.value)
    scrollToBottom()

    try {
      const token = localStorage.getItem('auth_token') || ''
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          type: 'shell',
          targets: targets,
          payload: cmd
        })
      })

      const data = await res.json()
      if (res.ok && data.status === 'success') {
        logItem.value.taskId = data.task_id
        deviceStore.startTrackingTask(data.task_id)
      } else {
        targets.forEach(id => {
          logItem.value.results[id] = { status: 'failed', output: data.error || 'Task dispatch failed' }
        })
      }
    } catch (e) {
      targets.forEach(id => {
        logItem.value.results[id] = { status: 'failed', output: e.message }
      })
    }
  }
}

function quickCmd(cmd) {
  inputCmd.value = cmd
  execCmd()
}

function scrollToBottom() {
  nextTick(() => {
    if (consoleRef.value) {
      consoleRef.value.scrollTop = consoleRef.value.scrollHeight
    }
  })
}

// Fullscreen maximize toggle
function toggleMaximize() {
  isMaximized.value = !isMaximized.value
  nextTick(() => {
    const activeSess = adbSessions.value.find(s => s.id === activeSessionId.value)
    if (activeSess && activeSess.isConnected && activeSess.adbInstance) {
      activeSess.adbInstance.resize()
    }
  })
}

// Secondary multi-session terminal management
function addAdbSession() {
  const id = nextSessionId.value++
  const newSession = {
    id,
    name: `Shell ${id}`,
    isConnected: false,
    adbInstance: null,
    unwatch: null
  }
  adbSessions.value.push(newSession)
  activeSessionId.value = id
  
  nextTick(() => {
    startAdbForSession(newSession)
  })
}

function startAdbForSession(sess) {
  if (webrtc.value) {
    const container = sessionContainers[sess.id]
    if (!container) return

    const { isAdbConnected: adbConnected, initAdb, closeAdb: close, resize: termResize } = useAdb(webrtc.value)
    sess.adbInstance = { initAdb, closeAdb: close, resize: termResize }
    
    sess.unwatch = watch(adbConnected, (val) => {
      sess.isConnected = val
    }, { immediate: true })
    
    sess.adbInstance.initAdb(container)
  }
}

function switchAdbSession(id) {
  activeSessionId.value = id
  nextTick(() => {
    const sess = adbSessions.value.find(s => s.id === id)
    if (sess && sess.adbInstance && sess.isConnected) {
      sess.adbInstance.resize()
    }
  })
}

function closeAdbSession(id) {
  const idx = adbSessions.value.findIndex(s => s.id === id)
  if (idx > -1) {
    const sess = adbSessions.value[idx]
    if (sess.adbInstance) {
      try { sess.adbInstance.closeAdb() } catch (e) {}
    }
    if (sess.unwatch) sess.unwatch()
    
    adbSessions.value.splice(idx, 1)
    delete sessionContainers[id]
    
    if (activeSessionId.value === id) {
      if (adbSessions.value.length > 0) {
        activeSessionId.value = adbSessions.value[adbSessions.value.length - 1].id
        nextTick(() => {
          const activeSess = adbSessions.value.find(s => s.id === activeSessionId.value)
          if (activeSess && activeSess.adbInstance && activeSess.isConnected) {
            activeSess.adbInstance.resize()
          }
        })
      } else {
        activeSessionId.value = null
      }
    }
  }
}

function cleanupAllAdbSessions() {
  adbSessions.value.forEach(sess => {
    if (sess.adbInstance) {
      try { sess.adbInstance.closeAdb() } catch (e) {}
    }
    if (sess.unwatch) sess.unwatch()
  })
  adbSessions.value = []
  activeSessionId.value = null
  nextSessionId.value = 1
  for (const k in sessionContainers) {
    delete sessionContainers[k]
  }
}

function closeAdb() {
  cleanupAllAdbSessions()
}

// AI Agent settings and skill management
// AI Agent settings and skill management
function loadConfigFromStorage() {
  aiUrl.value = safeStorageGet('ai_api_url', 'https://api.openai.com/v1')
  aiKey.value = safeStorageGet('ai_api_key', '')
  aiModel.value = safeStorageGet('ai_model', 'gpt-4o-mini')
  aiProvider.value = safeStorageGet('ai_provider', 'openai')
}

// Sync AI config across devices
watch(() => deviceStore.showGlobalConsole, (newVal) => {
  if (newVal) {
    loadConfigFromStorage()
  }
})

function saveAiSettings() {
  safeStorageSet('ai_api_url', aiUrl.value)
  safeStorageSet('ai_api_key', aiKey.value)
  safeStorageSet('ai_model', aiModel.value)
  safeStorageSet('ai_provider', aiProvider.value)

  // Sync asynchronously to server account
  authStore.saveAIConfig({
    ai_api_url: aiUrl.value,
    ai_api_key: aiKey.value,
    ai_model: aiModel.value,
    ai_provider: aiProvider.value
  }).then(success => {
    if (success) {
      logTrace('system', `AI configuration synced to server account`)
    } else {
      logTrace('system', `AI configuration applied locally, failed to sync to cloud`)
    }
  })

  showAiSettings.value = false
  logTrace('system', `AI configuration updated: Model ${aiModel.value}, Provider ${aiProvider.value}`)
}

function addNewSkillPrompt() {
  const name = prompt('Enter custom skill name (e.g. Check App Resource Usage):')
  if (!name) return
  const desc = prompt('Enter brief description of the skill:')
  if (!desc) return
  const promptText = prompt('Enter detailed prompt for the AI:')
  if (!promptText) return

  customSkills.value.push({ name, desc, prompt: promptText })
  safeStorageSet('ai_custom_skills', JSON.stringify(customSkills.value))
}

function deleteSkill(index) {
  if (confirm('Are you sure you want to delete this custom skill template?')) {
    customSkills.value.splice(index, 1)
    safeStorageSet('ai_custom_skills', JSON.stringify(customSkills.value))
  }
}

function runSkill(skill) {
  aiInput.value = skill.prompt
  sendAiMessage()
}

// AI Agent execution flow & Tool calling
function logTrace(type, text) {
  aiLogs.value.push({
    time: new Date(),
    type,
    text
  })
}

function formatTime(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function scrollToChatBottom() {
  nextTick(() => {
    if (chatRef.value) {
      chatRef.value.scrollTop = chatRef.value.scrollHeight
    }
  })
}

async function sendAiMessage() {
  if (!aiInput.value || !aiInput.value.trim() || aiLoading.value) return
  
  if (!aiKey.value) {
    alert('Please configure your AI Token/Key in the settings panel first!')
    showAiSettings.value = true
    return
  }

  const query = aiInput.value
  aiInput.value = ''
  
  // Add user message
  aiMessages.value.push({ role: 'user', content: query })
  aiLoading.value = true
  
  logTrace('info', `AI received prompt: "${query}"`)
  scrollToChatBottom()

  if (aiProvider.value === 'claude') {
    // Claude API request (no function calling)
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': aiKey.value,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: aiModel.value,
          max_tokens: 1024,
          messages: [{ role: 'user', content: query }]
        })
      })
      if (!resp.ok) {
        const err = await resp.text()
        throw new Error(`Claude API error ${resp.status}: ${err}`)
      }
      const data = await resp.json()
      const reply = data.content?.[0]?.text || ''
      aiMessages.value.push({ role: 'assistant', content: reply })
      logTrace('success', `AI replied: ${reply.substring(0,50)}...`)
    } catch (err) {
      console.error('[AI Agent] Claude error:', err)
      aiMessages.value.push({ role: 'assistant', content: err.message })
      logTrace('error', `Agent error: ${err.message}`)
    }
    aiLoading.value = false
    scrollToChatBottom()
    return
  }

  try {
    await runAgentLoop()
  } catch (err) {
    console.error('[AI Agent] Error in loop:', err)
    let errorMsg = err.message || 'Network error, please verify API Base URL and CORS configuration.'
    if (errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
      errorMsg = '❌ AI Agent authentication failed (HTTP 401): Invalid or expired API Key (Token). Please check your credentials in AI Connection Settings.'
      showAiSettings.value = true
    }
    aiMessages.value.push({ 
      role: 'assistant', 
      content: errorMsg
    })
    logTrace('error', `Agent fatal error: ${err.message}`)
  } finally {
    aiLoading.value = false
    scrollToChatBottom()
  }
}

async function runAgentLoop() {
  let iterations = 0
  const maxIterations = 8 // Prevent infinite loops

  const tools = [
    {
      type: 'function',
      function: {
        name: 'execute_shell_command',
        description: 'Execute adb shell command on cloud phone and get stdout/stderr results',
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Shell command to execute, e.g. pm list packages -3 or df -h /data' }
          },
          required: ['command']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_device_info',
        description: 'Get device name, status, model and hardware specs',
        parameters: { type: 'object', properties: {} }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_webrtc_stats',
        description: 'Read current WebRTC metrics (FPS, RTT, Jitter Buffer, packet loss)',
        parameters: { type: 'object', properties: {} }
      }
    },
    {
      type: 'function',
      function: {
        name: 'simulate_keyevent',
        description: 'Send physical key event, e.g. 3 (HOME), 4 (BACK), 26 (POWER)',
        parameters: {
          type: 'object',
          properties: {
            keycode: { type: 'integer', description: 'Android KeyEvent code' }
          },
          required: ['keycode']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'simulate_touch',
        description: 'Simulate click action at relative coordinates',
        parameters: {
          type: 'object',
          properties: {
            x: { type: 'integer', description: 'X coordinate' },
            y: { type: 'integer', description: 'Y coordinate' }
          },
          required: ['x', 'y']
        }
      }
    }
  ]

  const systemMessage = {
    role: 'system',
    content: `You are a cloud phone diagnostic and task execution assistant.
You are running on a virtual machine (device ID: ${props.deviceId}) inside the cloudphone operator panel.
You can execute real shell commands and collect details to troubleshoot network quality, memory leaks, system load, or app crashes.

Key requirements:
1. First, call get_device_info to check the device environment if you need basic info.
2. If the user complains about lag or WebRTC frozen, call get_webrtc_stats to diagnose Jitter Buffer (JB), RTT (network lag), and FPS. Explain recommendations to the user in Chinese.
3. Troubleshooting connection failures & blackscreen: If the user complains about connection timeout, failure, or blackscreen, you should directly inspect the Go agent logs located at '/data/local/tmp/cloudphone-agent.log' (e.g. by running 'su -c tail -n 200 /data/local/tmp/cloudphone-agent.log'). Specifically:
   a. Check if "No external NAT mappings configured" is printed. If yes, it indicates the agent is missing the host NAT IP (-external-addr or CP_AGENT_EXTERNAL_ADDR), causing cross-device routing failure.
   b. Inspect the ICE candidate IPs. Check if the device agent only bound local Docker private IPs (like 172.17.x.x) and if the client is using local proxy Tun modes (like Clash Tun 198.18.x.x) which blocks UDP connection checks.
   c. Verify that UDS channels (Video, Control, Touch) are all connected successfully.
   d. Check if CoreService exited unexpectedly, or if keyframe requests were skipped with reason "no-control-conn" or "no active codec" during initiation.
4. Be careful with command execution. Prefer safe, standard queries.
5. Output your responses and summaries in English.
`
  }

  while (iterations < maxIterations) {
    iterations++
    
    // Build request context
    const apiMessages = [
      systemMessage,
      ...aiMessages.value
    ]

    logTrace('info', `Sending request to LLM (${iterations}/${maxIterations})...`)
    
    const response = await fetch(`${aiUrl.value}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiKey.value}`
      },
      body: JSON.stringify({
        model: aiModel.value,
        messages: apiMessages,
        tools: tools,
        tool_choice: 'auto'
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      if (response.status === 401) {
        throw new Error(`LLM API returned HTTP 401 (Unauthorized): Invalid API Key. Details: ${errText}`)
      }
      throw new Error(`LLM API returned HTTP ${response.status}: ${errText}`)
    }

    const data = await response.json()
    const choice = data.choices?.[0]
    if (!choice) {
      throw new Error('Malformed API response: choices array is empty')
    }

    const message = choice.message
    
    // Append AI response to context
    aiMessages.value.push(message)
    scrollToChatBottom()

    if (message.content) {
      logTrace('success', `AI replied: ${message.content.substring(0, 50)}...`)
    }

    // Check for tool calls
    if (message.tool_calls && message.tool_calls.length > 0) {
      logTrace('info', `Found ${message.tool_calls.length} tool calls, executing...`)
      
      for (const toolCall of message.tool_calls) {
        const { name, arguments: argsStr } = toolCall.function
        let args = {}
        try {
          args = JSON.parse(argsStr)
        } catch (e) {
          console.warn('Failed to parse tool arguments:', argsStr)
        }

        logTrace('tool', `🔧 Calling tool: ${name}(${JSON.stringify(args)})`)
        let toolResultStr = ''
        
        try {
          const result = await executeAgentTool(name, args)
          toolResultStr = typeof result === 'object' ? JSON.stringify(result) : String(result)
          logTrace('success', `🔧 [${name}] Success. Bytes: ${toolResultStr.length}`)
        } catch (toolError) {
          toolResultStr = `Error: ${toolError.message}`
          logTrace('error', `🔧 [${name}] Failed: ${toolError.message}`)
        }

        // Push tool execution results to context
        aiMessages.value.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: name,
          content: toolResultStr
        })
      }
      
      // Continue next iteration
      scrollToChatBottom()
      continue
    }

    // If no tool calls, assistant reached conclusion; break loop
    break
  }

  if (iterations >= maxIterations) {
    logTrace('warning', 'AI Agent reached max iterations, ending loop')
  }
}

async function executeAgentTool(name, args) {
  if (!webrtc.value) {
    throw new Error('WebRTC not connected, cannot execute command')
  }

  switch (name) {
    case 'execute_shell_command':
      if (!args.command) throw new Error('Missing command parameter')
      logTrace('info', `[ADB Shell] Executing: "${args.command}"`)
      const res = await webrtc.value.executeCommandP2P(args.command)
      return {
        exit_code: res.exit_code,
        stdout: res.stdout || '',
        stderr: res.stderr || ''
      }
      
    case 'get_device_info':
      const targetDev = deviceStore.devices.find(d => d.id === props.deviceId)
      return {
        device_id: props.deviceId,
        model: targetDev?.model || 'Generic Redroid',
        tags: deviceStore.deviceTags[props.deviceId] || [],
        webrtc_status: webrtcStatus.value,
        agent_version: webrtc.value.agentVersion.value
      }

    case 'get_webrtc_stats':
      const stats = await webrtc.value.getVideoStats()
      if (!stats) return { error: 'Cannot get WebRTC stats, stream might not be connected' }
      return stats

    case 'simulate_keyevent':
      if (args.keycode === undefined) throw new Error('Missing keycode parameter')
      webrtc.value.sendInjectKeycode(0, args.keycode)
      await new Promise(r => setTimeout(r, 50))
      webrtc.value.sendInjectKeycode(1, args.keycode)
      return { status: 'success', keycode: args.keycode }

    case 'simulate_touch':
      if (args.x === undefined || args.y === undefined) throw new Error('Missing coordinates parameter')
      const targetCoord = { x: args.x, y: args.y }
      webrtc.value.sendTouch(0, args.x, args.y, -1, targetCoord)
      await new Promise(r => setTimeout(r, 60))
      webrtc.value.sendTouch(1, args.x, args.y, -1, targetCoord)
      return { status: 'success', clicked: targetCoord }

    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}



// Watch changes
watch(() => props.deviceId, (newId) => {
  if (newId) {
    setupDeviceConnection(newId)
  }
})

// Watch active connection rebuild
watch(() => deviceStore.activeWebRTCMap, (newMap) => {
  if (props.deviceId && newMap.has(props.deviceId)) {
    console.log('[Console] Active WebRTC changed, updating console connection...')
    setupDeviceConnection(props.deviceId)
  }
}, { deep: true })

function startResizingConsole(e) {
  e.preventDefault()
  const startY = e.clientY
  const startHeight = deviceStore.globalConsoleHeight

  const onMouseMove = (ev) => {
    const dy = ev.clientY - startY
    // Resize calculation
    const newHeight = startHeight - dy
    deviceStore.setConsoleHeight(newHeight)
  }

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

let resizeObserver = null

onMounted(() => {
  setupDeviceConnection(props.deviceId)
  loadShortcuts()
  tagStore.load()
  
  if (typeof ResizeObserver !== 'undefined' && consoleMainRef.value) {
    resizeObserver = new ResizeObserver(() => {
      // Terminal fit on resize
      const activeSess = adbSessions.value.find(s => s.id === activeSessionId.value)
      if (activeSess && activeSess.isConnected && activeSess.adbInstance) {
        activeSess.adbInstance.resize()
      }
    })
    resizeObserver.observe(consoleMainRef.value)
  }
})

onUnmounted(() => {
  cleanupConnection()
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})
</script>

<style scoped>
.device-console {
  display: flex;
  flex-direction: column;
  width: 100%;
  flex: 1;
  background: #0f0f1a;
  color: #f0f6fc;
  border-radius: 12px 12px 0 0;
  overflow: hidden;
  box-shadow: inset 0 0 20px rgba(255, 255, 255, 0.02), 0 -8px 32px rgba(0, 0, 0, 0.5);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  position: relative;
}

.console-resizer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 6px;
  cursor: ns-resize;
  z-index: 100;
  background: transparent;
  transition: background 0.2s;
}

.console-resizer:hover {
  background: rgba(88, 166, 255, 0.45);
}

/* Tab header */
.console-tabs-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #161b22;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding: 0 16px;
  flex-shrink: 0;
  user-select: none;
}

.console-right-tools {
  display: flex;
  align-items: center;
  gap: 12px;
}

.console-close-btn {
  background: none;
  border: none;
  color: #8b949e;
  cursor: pointer;
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
}

.console-close-btn:hover {
  color: #f85149;
  background: rgba(248, 81, 73, 0.15);
}

.console-close-btn svg {
  width: 16px;
  height: 16px;
}

.tabs-group {
  display: flex;
  gap: 4px;
}

.tabs-group button {
  background: none;
  border: none;
  color: #8b949e;
  padding: 14px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 2px solid transparent;
  transition: all 0.2s ease;
}

.tabs-group button.active {
  color: #58a6ff;
  border-bottom-color: #58a6ff;
  background: rgba(88, 166, 255, 0.06);
}

.tabs-group button:hover:not(.active) {
  color: #c9d1d9;
  background: rgba(255, 255, 255, 0.03);
}

.tab-icon {
  width: 16px;
  height: 16px;
}

.beta-badge {
  background: rgba(233, 69, 96, 0.2);
  color: #e94560;
  font-size: 9px;
  padding: 1px 4px;
  border-radius: 4px;
  border: 1px solid rgba(233, 69, 96, 0.3);
  margin-left: 2px;
}

.console-device-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(0, 0, 0, 0.3);
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  font-family: monospace;
  font-size: 12px;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #8b949e;
}

.status-indicator.connected {
  background: #3fb950;
  box-shadow: 0 0 8px rgba(63, 185, 80, 0.6);
}

.status-indicator.connecting {
  background: #dbb32d;
  animation: pulse 1s infinite alternate;
}

.status-indicator.error {
  background: #f85149;
  box-shadow: 0 0 8px rgba(248, 81, 73, 0.6);
}

@keyframes pulse {
  0% { opacity: 0.4; }
  100% { opacity: 1; }
}

/* Tab content */
.console-tab-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  position: relative;
  background: #000000;
}

/* 1. Shell tab styles */
.shell-tab-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 100%;
  overflow: hidden;
}

.console-history {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  font-family: 'Fira Code', 'Courier New', monospace;
  font-size: 12px;
  background: #06060c;
  line-height: 1.5;
}

.console-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 70%;
  color: #44445c;
  gap: 12px;
}

.empty-icon {
  width: 40px;
  height: 40px;
}

.log-item {
  margin-bottom: 12px;
  animation: fadeIn 0.2s ease-out;
}

.log-cmd {
  color: #58a6ff;
  font-weight: bold;
}

.log-out {
  white-space: pre-wrap;
  word-break: break-all;
  margin: 4px 0 0 0;
  color: #c9d1d9;
}

.log-item.error .log-out {
  color: #ff5555;
  background: rgba(255, 85, 85, 0.05);
  padding: 4px 8px;
  border-radius: 4px;
}

.log-item.success .log-out {
  color: #50fa7b;
}

.console-shortcuts {
  display: flex;
  padding: 8px 16px;
  gap: 8px;
  background: #161b22;
  overflow-x: auto;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.console-shortcuts button {
  background: #21262d;
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #8b949e;
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 11px;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s ease;
}

.console-shortcuts button:hover {
  background: #30363d;
  color: #f0f6fc;
  border-color: #8b949e;
}

.console-input-group {
  display: flex;
  padding: 12px 16px;
  gap: 8px;
  background: #161b22;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.cmd-input {
  flex: 1;
  background: #0d1117;
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #fff;
  padding: 8px 12px;
  border-radius: 6px;
  outline: none;
  font-size: 13px;
}

.cmd-input:focus {
  border-color: #58a6ff;
  box-shadow: 0 0 8px rgba(88, 166, 255, 0.2);
}

.send-btn {
  background: #58a6ff;
  color: white;
  border: none;
  padding: 0 18px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s;
}

.send-btn:hover:not(:disabled) {
  background: #1f85ff;
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 2. ADB interactive terminal styles */
.adb-tab-panel {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.adb-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 40px;
  color: #8b949e;
  background: #0c0c14;
}

.adb-icon {
  width: 64px;
  height: 64px;
  color: #58a6ff;
  margin-bottom: 16px;
  opacity: 0.7;
}

.adb-placeholder h3 {
  color: #f0f6fc;
  font-size: 16px;
  margin-bottom: 8px;
}

.adb-placeholder p {
  font-size: 13px;
  max-width: 420px;
  margin-bottom: 20px;
  line-height: 1.6;
}

.adb-connect-btn {
  background: #58a6ff;
  color: white;
  border: none;
  padding: 10px 24px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.adb-connect-btn:hover:not(:disabled) {
  background: #1f85ff;
}

.adb-connect-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.xterm-view-container {
  flex: 1;
  width: 100%;
  height: 0;
  min-height: 0;
  padding: 12px;
  box-sizing: border-box;
  background: #000;
}

/* 3. AI Assistant styles */
.ai-tab-panel {
  flex: 1;
  display: flex;
  height: 100%;
  overflow: hidden;
  background: #0c0c14;
}

/* Quick skills sidebar */
.ai-skills-sidebar {
  width: 200px;
  background: #121221;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.sidebar-header h4 {
  font-size: 12px;
  font-weight: 600;
  color: #8b949e;
  margin: 0;
}

.add-skill-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #8b949e;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.add-skill-btn:hover {
  background: rgba(88, 166, 255, 0.1);
  color: #58a6ff;
  border-color: #58a6ff;
}

.skills-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skill-item {
  background: #1c1c2e;
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  padding: 8px 10px;
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  position: relative;
  transition: all 0.2s;
  width: 100%;
}

.skill-item:hover:not(:disabled) {
  border-color: #58a6ff;
  background: rgba(88, 166, 255, 0.05);
  transform: translateY(-1px);
}

.skill-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.skill-name {
  font-size: 11px;
  font-weight: bold;
  color: #f0f6fc;
  margin-bottom: 2px;
}

.skill-desc {
  font-size: 9px;
  color: #8b949e;
  line-height: 1.3;
}

.skill-delete {
  position: absolute;
  top: 4px;
  right: 6px;
  color: #f85149;
  font-size: 14px;
  opacity: 0.6;
  cursor: pointer;
  transition: opacity 0.2s;
}

.skill-delete:hover {
  opacity: 1;
}

/* AI conversation main area */
.ai-main-chat {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.ai-config-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: #121221;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 11px;
  color: #8b949e;
  flex-shrink: 0;
}

.ai-settings-toggle {
  background: none;
  border: none;
  color: #8b949e;
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}

.ai-settings-toggle:hover {
  color: #f0f6fc;
}

.ai-settings-toggle .icon {
  width: 12px;
  height: 12px;
}

.ai-model-badge {
  background: rgba(88, 166, 255, 0.1);
  color: #58a6ff;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
}

/* Settings Drawer */
.ai-settings-panel {
  background: #161b22;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 10;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

.form-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.form-row label {
  width: 110px;
  font-size: 12px;
  color: #8b949e;
  text-align: right;
}

.form-row input {
  flex: 1;
  background: #0d1117;
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: white;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 12px;
  outline: none;
}

.password-input-wrapper {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
}

.password-input-wrapper input {
  width: 100%;
  padding-right: 32px;
}

.eye-toggle-btn {
  position: absolute;
  right: 8px;
  background: transparent;
  border: none;
  color: #8b949e;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
  outline: none;
}

.eye-toggle-btn:hover {
  color: white;
}

.eye-toggle-btn .icon {
  width: 15px;
  height: 15px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
}

.save-settings-btn {
  background: #3fb950;
  color: white;
  border: none;
  padding: 5px 14px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.save-settings-btn:hover {
  background: #2ea043;
}

/* System Action Tracing Logs */
.ai-trace-panel {
  background: #09090f;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  max-height: 120px;
  overflow-y: auto;
  padding: 8px 16px;
  display: flex;
  flex-direction: column;
  font-family: monospace;
  font-size: 10px;
}

.trace-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #8b949e;
  margin-bottom: 4px;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.05);
  padding-bottom: 4px;
}

.clear-trace-btn {
  background: none;
  border: none;
  color: #f85149;
  cursor: pointer;
  font-size: 9px;
}

.trace-log-line {
  display: flex;
  gap: 8px;
  line-height: 1.4;
}

.trace-time {
  color: #44445c;
  flex-shrink: 0;
}

.trace-text.system { color: #8b949e; }
.trace-text.info { color: #58a6ff; }
.trace-text.tool { color: #e94560; font-weight: bold; }
.trace-text.success { color: #50fa7b; }
.trace-text.error { color: #ff5555; }
.trace-text.warning { color: #ffb86c; }

/* Chat content area */
.ai-chat-history {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: #07070d;
}

.chat-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 90%;
  text-align: center;
  color: #8b949e;
}

.chat-empty h3 {
  color: #f0f6fc;
  font-size: 16px;
  margin-bottom: 6px;
}

.chat-empty p {
  font-size: 12px;
  line-height: 1.6;
  max-width: 440px;
}

.chat-bubble-wrapper {
  display: flex;
  width: 100%;
}

.chat-bubble-wrapper.user {
  justify-content: flex-end;
}

.chat-bubble-wrapper.assistant {
  justify-content: flex-start;
}

.chat-bubble {
  max-width: 85%;
  border-radius: 12px;
  padding: 10px 14px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  position: relative;
}

.chat-bubble-wrapper.user .chat-bubble {
  background: #1f6feb;
  color: white;
  border-bottom-right-radius: 2px;
}

.chat-bubble-wrapper.assistant .chat-bubble {
  background: #161b22;
  color: #c9d1d9;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-bottom-left-radius: 2px;
}

.bubble-header {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 4px;
  font-weight: bold;
}

.chat-bubble-wrapper.user .bubble-header {
  text-align: right;
}

.bubble-content {
  font-size: 12.5px;
  line-height: 1.5;
}

.formatted-text {
  white-space: pre-wrap;
  word-break: break-all;
  font-family: inherit;
  margin: 0;
}

.tool-calls-display {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
  border-top: 1px dashed rgba(255, 255, 255, 0.06);
  padding-top: 6px;
}

.tool-badge {
  font-size: 10px;
  color: #ffb86c;
  background: rgba(255, 184, 108, 0.08);
  padding: 3px 8px;
  border-radius: 4px;
  font-family: monospace;
}

/* AI loading dots animation */
.loading-state .chat-bubble {
  background: #161b22;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
  padding: 12px 20px;
}

.loading-dots {
  display: flex;
  gap: 4px;
}

.loading-dots span {
  width: 6px;
  height: 6px;
  background: #58a6ff;
  border-radius: 50%;
  animation: dot-bounce 1.4s infinite ease-in-out both;
}

.loading-dots span:nth-child(1) { animation-delay: -0.32s; }
.loading-dots span:nth-child(2) { animation-delay: -0.16s; }

@keyframes dot-bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1.0); }
}

.loading-tip {
  font-size: 9px;
  color: #8b949e;
}

/* AI input area */
.ai-input-group {
  display: flex;
  padding: 12px 16px;
  gap: 8px;
  background: #121221;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.ai-chat-input {
  flex: 1;
  background: #0d1117;
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  outline: none;
  font-size: 13px;
  resize: none;
  font-family: inherit;
}

.ai-chat-input:focus {
  border-color: #58a6ff;
}

.ai-send-btn {
  background: #58a6ff;
  color: white;
  border: none;
  padding: 0 16px;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s;
  align-self: flex-end;
  height: 38px;
}

.ai-send-btn:hover:not(:disabled) {
  background: #1f85ff;
}

.ai-send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Transition Animations */
.slide-enter-active, .slide-leave-active {
  transition: all 0.2s ease-out;
}
.slide-enter-from, .slide-leave-to {
  transform: translateY(-10px);
  opacity: 0;
}

/* Responsive styles */
@media (max-width: 768px) {
  .ai-tab-panel {
    flex-direction: column;
  }
  
  .ai-skills-sidebar {
    width: 100%;
    height: 110px;
    border-right: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }
  
  .skills-list {
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 6px;
    height: 76px;
  }
  
  .skill-item {
    width: 140px;
    flex-shrink: 0;
  }
}

.device-selector-dropdown {
  background: #21262d;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  color: #c9d1d9;
  font-family: monospace;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  outline: none;
  padding: 4px 8px;
  transition: border-color 0.2s;
}

.device-selector-dropdown:hover {
  border-color: #58a6ff;
}

.device-selector-dropdown option {
  background: #161b22;
  color: #c9d1d9;
}

/* Fullscreen styles */
.device-console.is-maximized {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw !important;
  height: 100vh !important;
  z-index: 2100;
  border-radius: 0;
  border-top: none;
}

/* Console header tool buttons */
.console-tool-btn {
  background: none;
  border: none;
  color: #8b949e;
  cursor: pointer;
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
}

.console-tool-btn:hover {
  color: #58a6ff;
  background: rgba(88, 166, 255, 0.15);
}

.console-tool-btn svg {
  width: 15px;
  height: 15px;
}

/* Secondary ADB multi-session tab bar */
.adb-sessions-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #0d1117;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  padding: 0 12px;
  height: 36px;
  flex-shrink: 0;
  user-select: none;
}

.adb-tabs-group {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 100%;
}

.adb-session-tab {
  background: none;
  border: none;
  color: #8b949e;
  padding: 0 12px;
  height: 28px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.adb-session-tab:hover {
  color: #c9d1d9;
  background: rgba(255, 255, 255, 0.03);
}

.adb-session-tab.active {
  color: #58a6ff;
  background: rgba(88, 166, 255, 0.1);
  font-weight: 600;
}

.tab-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #8b949e;
}

.tab-status-dot.connected {
  background: #3fb950;
  box-shadow: 0 0 8px rgba(63, 185, 80, 0.5);
}

.close-sess-btn {
  font-size: 14px;
  line-height: 1;
  color: #8b949e;
  transition: color 0.2s;
  padding: 2px;
  border-radius: 50%;
}

.close-sess-btn:hover {
  color: #f85149;
  background: rgba(248, 81, 73, 0.15);
}

.add-sess-btn {
  background: none;
  border: 1px dashed rgba(255, 255, 255, 0.15);
  color: #8b949e;
  width: 22px;
  height: 22px;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
  padding: 0;
}

.add-sess-btn:hover:not(:disabled) {
  color: #58a6ff;
  border-color: #58a6ff;
  background: rgba(88, 166, 255, 0.05);
}

.add-sess-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.max-sess-tip {
  font-size: 11px;
  color: #484f58;
}

/* Batch Shell style system */
.batch-shell-tab-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
  box-sizing: border-box;
  overflow: hidden;
}

.batch-shell-devices-selector {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* Integrated terminal styles */
.shell-targets-bar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #161b22;
  border-top: 1px solid #30363d;
  border-bottom: 1px solid #30363d;
  padding: 8px 16px;
  box-sizing: border-box;
}

.targets-control-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  width: 100%;
}

.select-all-check {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  color: #c9d1d9;
  cursor: pointer;
  user-select: none;
}

.select-all-check input {
  margin-right: 6px;
  cursor: pointer;
}

.tag-filters {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.tag-filter-label {
  font-size: 12px;
  color: #8b949e;
}

.tag-filter-btn {
  padding: 2px 8px;
  font-size: 11px;
  border-radius: 12px;
  border: 1px solid;
  cursor: pointer;
  transition: all 0.2s ease;
  outline: none;
  font-weight: 500;
  background: transparent;
}

.tag-filter-btn:hover {
  filter: brightness(1.2);
}

.shell-targets-bar .label {
  font-size: 12px;
  font-weight: 600;
  color: #8b949e;
}

.shell-targets-bar .targets-list {
  display: flex;
  align-items: center;
  gap: 12px;
}

.target-check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #c9d1d9;
  cursor: pointer;
  user-select: none;
}

.target-check.current {
  opacity: 0.8;
  cursor: default;
}

.target-check input[type="checkbox"] {
  width: 13px;
  height: 13px;
  accent-color: #58a6ff;
  cursor: pointer;
}

.target-check.current input[type="checkbox"] {
  cursor: default;
}

/* Batch output rendering in history */
.log-item.batch_result {
  border-left: 2px solid #58a6ff;
  padding-left: 8px;
  margin: 12px 0;
  background: rgba(88, 166, 255, 0.02);
}

.batch-outputs-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
}

.batch-output-row {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 4px;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.batch-output-row.running {
  border-color: rgba(210, 153, 34, 0.4);
}

.batch-output-row.success {
  border-color: rgba(46, 160, 67, 0.4);
}

.batch-output-row.failed {
  border-color: rgba(248, 81, 73, 0.4);
}

.batch-output-row .row-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.batch-output-row .dev-tag {
  font-size: 12px;
  font-weight: 600;
  color: #c9d1d9;
}

.batch-output-row .status-tag {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 10px;
  font-weight: 600;
}

.batch-output-row .status-tag.running {
  background: rgba(210, 153, 34, 0.15);
  color: #d29922;
}

.batch-output-row .status-tag.success {
  background: rgba(46, 160, 67, 0.15);
  color: #56d364;
}

.batch-output-row .status-tag.failed {
  background: rgba(248, 81, 73, 0.15);
  color: #ff7b72;
}

.batch-output-row .dev-output {
  margin: 0;
  font-family: SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace;
  font-size: 12px;
  line-height: 1.5;
  color: #c9d1d9;
  white-space: pre-wrap;
  word-break: break-all;
  background: #0d1117;
  padding: 6px 10px;
  border-radius: 4px;
}

/* xterm.js viewport override */
:deep(.xterm-viewport) {
  padding-bottom: 32px !important;
}
:deep(.xterm-screen) {
  padding-bottom: 32px !important;
}

.console-shortcuts button.system-btn {
  background: rgba(88, 166, 255, 0.1);
  color: #58a6ff;
  border-color: rgba(88, 166, 255, 0.2);
}

.console-shortcuts button.system-btn:hover {
  background: rgba(88, 166, 255, 0.2);
  color: #58a6ff;
  border-color: #58a6ff;
}

.console-shortcuts button.edit-btn {
  margin-left: auto;
}

/* Custom quick commands modal */
.shortcut-modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
}

.shortcut-modal-card {
  width: 90%;
  max-width: 600px;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  max-height: 80%;
  animation: modalEnter 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.shortcut-modal-card .modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid #30363d;
}

.shortcut-modal-card .modal-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #f0f6fc;
}

.shortcut-modal-card .modal-header .close-btn {
  background: transparent;
  border: none;
  color: #8b949e;
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
}

.shortcut-modal-card .modal-header .close-btn:hover {
  color: #f0f6fc;
}

.shortcut-modal-card .modal-body {
  padding: 16px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.shortcut-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.shortcut-item-row {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  background: #0d1117;
  padding: 10px;
  border-radius: 6px;
  border: 1px solid #21262d;
}

.shortcut-item-row .input-col {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.shortcut-item-row .input-col label {
  font-size: 11px;
  color: #8b949e;
}

.shortcut-item-row .input-col input {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 4px;
  color: #c9d1d9;
  padding: 6px 10px;
  font-size: 12px;
  outline: none;
}

.shortcut-item-row .input-col input:focus {
  border-color: #58a6ff;
}

.shortcut-item-row .name-col {
  flex: 1;
}

.shortcut-item-row .cmd-col {
  flex: 2;
}

.shortcut-item-row .delete-btn {
  background: transparent;
  border: none;
  color: #f85149;
  cursor: pointer;
  padding: 8px;
  font-size: 14px;
}

.shortcut-item-row .delete-btn:hover {
  opacity: 0.8;
}

.no-shortcuts {
  text-align: center;
  color: #8b949e;
  padding: 20px 0;
  font-size: 12px;
}

.add-row-btn {
  background: transparent;
  border: 1px dashed #30363d;
  color: #58a6ff;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s ease;
  text-align: center;
}

.add-row-btn:hover {
  background: rgba(88, 166, 255, 0.05);
  border-color: #58a6ff;
}

.shortcut-modal-card .modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-top: 1px solid #30363d;
  background: #0d1117;
  border-bottom-left-radius: 8px;
  border-bottom-right-radius: 8px;
}

.shortcut-modal-card .modal-footer .btn {
  padding: 6px 12px;
  font-size: 12px;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid transparent;
}

.shortcut-modal-card .modal-footer .btn-reset {
  background: transparent;
  border-color: #30363d;
  color: #f85149;
}

.shortcut-modal-card .modal-footer .btn-reset:hover {
  background: rgba(248, 81, 73, 0.05);
}

.shortcut-modal-card .modal-footer .footer-actions {
  display: flex;
  gap: 8px;
}

.shortcut-modal-card .modal-footer .btn-cancel {
  background: transparent;
  border-color: #30363d;
  color: #c9d1d9;
}

.shortcut-modal-card .modal-footer .btn-cancel:hover {
  background: rgba(255, 255, 255, 0.05);
}

.shortcut-modal-card .modal-footer .btn-save {
  background: #238636;
  color: #fff;
}

.shortcut-modal-card .modal-footer .btn-save:hover {
  background: #2ea043;
}
</style>
