<template>
  <div class="file-manager-page">
    <header class="fm-header">
      <div class="fm-title-block">
        <div class="fm-title-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"></path>
          </svg>
        </div>
        <div>
          <h2>File Manager</h2>
          <p>{{ selectedDeviceId || 'Select an online device to manage files' }}</p>
        </div>
      </div>

      <div class="fm-device-panel">
        <select v-model="selectedDeviceId" class="device-select" aria-label="Select Device">
          <option value="" disabled>Select Online Device</option>
          <option v-for="d in deviceStore.onlineDevices" :key="d.id" :value="d.id">
            {{ d.name || d.id }}
          </option>
        </select>
        <div class="connection-pill" :class="connectionClass">
          <span class="status-dot"></span>
          <span>{{ connectionText }}</span>
        </div>
      </div>
    </header>

    <main class="fm-body">
      <section v-if="!selectedDeviceId" class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"></path>
          <path d="M8 13h8"></path>
        </svg>
        <h3>No Device Selected</h3>
        <p>Select an online device to establish the file channel.</p>
      </section>

      <section v-else-if="isConnecting" class="empty-state">
        <div class="spinner"></div>
        <h3>Connecting File Channel</h3>
        <p>Establishing WebRTC data channel...</p>
      </section>

      <section v-else-if="webrtcError" class="empty-state error">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="9"></circle>
          <path d="m15 9-6 6"></path>
          <path d="m9 9 6 6"></path>
        </svg>
        <h3>Connection Failed</h3>
        <p>{{ webrtcError }}</p>
        <button class="primary-btn" @click="reconnectDevice">Retry</button>
      </section>

      <section v-else class="fm-shell">
        <div class="toolbar">
          <button class="icon-btn" @click="goUpFolder" :disabled="currentPath === '/'" title="Go Up">
            <svg viewBox="0 0 24 24"><path d="M19 12H5"></path><path d="m12 19-7-7 7-7"></path></svg>
          </button>
          <div class="path-box">
            <span>Path</span>
            <input v-model="pathDraft" @keyup.enter="applyPath" @blur="pathDraft = currentPath" />
          </div>
          <button class="icon-btn" @click="refreshFileList" title="Refresh">
            <svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-2.64-6.36"></path><path d="M21 3v6h-6"></path></svg>
          </button>
          <button class="icon-btn" @click="showNewFolderPrompt" title="New Folder">
            <svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"></path><path d="M12 11v6"></path><path d="M9 14h6"></path></svg>
          </button>
          <label class="upload-btn" :class="{ disabled: hasActiveUpload }" title="Upload File">
            <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="m17 8-5-5-5 5"></path><path d="M12 3v12"></path></svg>
            <span>Upload</span>
            <input type="file" :disabled="hasActiveUpload" @change="onFileSelected" />
          </label>
        </div>

        <div class="selection-bar" :class="{ visible: selectedFiles.length > 0 }">
          <div class="selection-summary">
            <strong>{{ selectedFiles.length }}</strong>
            <span>item(s) selected</span>
          </div>
          <div class="selection-actions">
            <button class="secondary-btn" @click="clearSelection">Clear Selection</button>
            <button class="secondary-btn" :disabled="selectedDownloadableFiles.length === 0" @click="downloadSelected">Download</button>
            <button class="secondary-btn" :disabled="selectedInstallableFiles.length === 0" @click="installSelectedApks">Install APK</button>
            <button class="danger-btn" @click="deleteSelected">Delete</button>
          </div>
        </div>

        <div
          class="file-surface"
          :class="{ 'drag-over': dragOver }"
          @dragover.prevent="dragOver = true"
          @dragleave="dragOver = false"
          @drop.prevent="onFileDropped"
        >
          <div v-if="dragOver" class="drag-overlay">
            <div>Drop files here to upload to current folder</div>
          </div>

          <div class="list-head">
            <label class="check-cell">
              <input type="checkbox" :checked="allVisibleSelected" @change="toggleSelectAll($event.target.checked)" />
            </label>
            <button class="head-name" @click="setSort('name')">Name {{ sortMark('name') }}</button>
            <button class="head-meta" @click="setSort('size')">Size {{ sortMark('size') }}</button>
            <button class="head-meta" @click="setSort('mod_time')">Modified Time {{ sortMark('mod_time') }}</button>
          </div>

          <div v-if="filesLoading" class="list-state">
            <div class="spinner small"></div>
            <span>Loading file list...</span>
          </div>
          <div v-else-if="sortedFiles.length === 0" class="list-state">
            <span>Empty directory or permission denied</span>
          </div>
          <div v-else class="file-list">
            <div
              v-for="file in sortedFiles"
              :key="file.path"
              class="file-row"
              :class="{ selected: selectedPaths.has(file.path), folder: file.is_dir }"
              @click="onRowClick(file)"
              @dblclick.stop="onRowDblClick(file)"
            >
              <label class="check-cell" @click.stop>
                <input type="checkbox" :checked="selectedPaths.has(file.path)" @change="toggleFileSelection(file, $event.target.checked)" />
              </label>
              <div class="file-primary">
                <div class="file-icon" :class="{ folder: file.is_dir, apk: isApk(file) }">
                  <svg v-if="file.is_dir" viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"></path></svg>
                  <svg v-else-if="isApk(file)" viewBox="0 0 24 24"><path d="M7 8h10"></path><path d="M8 8V6"></path><path d="M16 8V6"></path><path d="M6 10h12v7a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2Z"></path><path d="M10 13v2"></path><path d="M14 13v2"></path></svg>
                  <svg v-else viewBox="0 0 24 24"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7Z"></path><path d="M14 2v5h5"></path></svg>
                </div>
                <div class="file-text">
                  <span class="file-name">{{ file.name }}</span>
                  <span class="file-path">{{ file.path }}</span>
                </div>
              </div>
              <div class="file-size">{{ file.is_dir ? 'Folder' : formatFileSize(file.size) }}</div>
              <div class="file-date">{{ formatTime(file.mod_time) }}</div>
            </div>
          </div>
        </div>

        <aside v-if="activeTransfers.length > 0" class="transfer-dock">
          <div class="dock-head">
            <span>Transfers</span>
            <button @click="clearFinishedTransfers">Clear Completed</button>
          </div>
          <div class="transfer-list">
            <div v-for="t in activeTransfers" :key="t.id" class="transfer-item" :class="t.status">
              <div class="transfer-main">
                <span class="transfer-name" :title="t.name">{{ t.name }}</span>
                <span class="transfer-status">{{ transferLabel(t) }}</span>
              </div>
              <div class="transfer-progress">
                <div :style="{ width: t.progress + '%' }"></div>
              </div>
              <button v-if="isTransferDone(t)" @click="removeTransfer(t.id)">×</button>
            </div>
          </div>
        </aside>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useDeviceStore } from '@/stores/devices'
import { useWebRTC } from '@/composables/useWebRTC'
import { hashFileIncremental } from '@/utils/sha256'

const deviceStore = useDeviceStore()
const selectedDeviceId = ref('')

let webrtc = null
let unwatchStatus = null
let unwatchError = null
let unwatchReady = null
let isSharedConnection = false
const webrtcStatus = ref('disconnected')
const webrtcError = ref(null)
const isFileChannelReady = ref(false)

const currentPath = ref('/sdcard')
const pathDraft = ref('/sdcard')
const fileList = ref([])
const filesLoading = ref(false)
const dragOver = ref(false)
const selectedPaths = ref(new Set())
const sortKey = ref('name')
const sortDir = ref('asc')
const activeTransfers = ref([])
let transferIdSeq = 0
let activeDownloadSession = null
let activeInstallSession = null

const downloadSessions = {}
const uploadSessions = {}
const installSessions = {}
const downloadQueue = []
const installQueue = []

const isConnecting = computed(() => ['connecting', 'signaling', 'waiting_offer', 'connecting_webrtc'].includes(webrtcStatus.value))

const connectionText = computed(() => {
  if (!selectedDeviceId.value) return 'Not Connected'
  if (isFileChannelReady.value) return 'Connected'
  if (webrtcError.value) return 'Error'
  if (isConnecting.value) return 'Connecting'
  return 'Not Connected'
})

const connectionClass = computed(() => {
  if (!selectedDeviceId.value) return 'disconnected'
  if (isFileChannelReady.value) return 'connected'
  if (webrtcError.value) return 'error'
  return 'connecting'
})

const sortedFiles = computed(() => {
  const files = [...fileList.value]
  const direction = sortDir.value === 'asc' ? 1 : -1
  files.sort((a, b) => {
    if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1
    let av = a[sortKey.value]
    let bv = b[sortKey.value]
    if (sortKey.value === 'name') {
      av = String(av || '').toLowerCase()
      bv = String(bv || '').toLowerCase()
      return av.localeCompare(bv) * direction
    }
    return ((Number(av) || 0) - (Number(bv) || 0)) * direction
  })
  return files
})

const selectedFiles = computed(() => sortedFiles.value.filter(file => selectedPaths.value.has(file.path)))
const selectedDownloadableFiles = computed(() => selectedFiles.value.filter(file => !file.is_dir))
const selectedInstallableFiles = computed(() => selectedFiles.value.filter(file => !file.is_dir && isApk(file)))
const allVisibleSelected = computed(() => sortedFiles.value.length > 0 && sortedFiles.value.every(file => selectedPaths.value.has(file.path)))
const hasActiveUpload = computed(() => activeTransfers.value.some(item => ['upload', 'upload-install'].includes(item.type) && !isTransferDone(item)))

watch(currentPath, (path) => {
  pathDraft.value = path
})

function cleanWebRTC() {
  if (unwatchStatus) { unwatchStatus(); unwatchStatus = null }
  if (unwatchError) { unwatchError(); unwatchError = null }
  if (unwatchReady) { unwatchReady(); unwatchReady = null }

  if (webrtc) {
    if (!isSharedConnection) {
      webrtc.disconnect()
    } else {
      webrtc.onFileChannelMessage(null)
    }
    webrtc = null
  }
  isSharedConnection = false
  webrtcStatus.value = 'disconnected'
  webrtcError.value = null
  isFileChannelReady.value = false
  fileList.value = []
  resetTransferState()
  clearSelection()
}

function reconnectDevice() {
  if (!selectedDeviceId.value) return
  const id = selectedDeviceId.value
  selectedDeviceId.value = ''
  setTimeout(() => {
    selectedDeviceId.value = id
  }, 100)
}

watch(selectedDeviceId, (newId) => {
  cleanWebRTC()
  if (!newId) return

  // Check for active direct WebRTC instance
  const sharedInst = deviceStore.getWebRTC(newId)
  if (sharedInst) {
    webrtc = sharedInst
    isSharedConnection = true
  } else {
    webrtc = useWebRTC(newId, { audio: false, video: false })
    isSharedConnection = false
  }

  unwatchStatus = watch(() => webrtc?.status?.value, (newStatus) => {
    webrtcStatus.value = newStatus || 'disconnected'
  }, { immediate: true })

  unwatchError = watch(() => webrtc?.error?.value, (newErr) => {
    webrtcError.value = newErr || null
  }, { immediate: true })

  unwatchReady = watch(() => webrtc?.fileChannelReady?.value, (ready) => {
    isFileChannelReady.value = Boolean(ready)
    if (ready) refreshFileList()
  }, { immediate: true })

  webrtc.onFileChannelMessage(handleFileChannelMessage)

  if (!isSharedConnection) {
    setTimeout(() => {
      if (!webrtc) return
      webrtc.connect()
    }, 50)
  } else if (isFileChannelReady.value) {
    refreshFileList()
  }
})

watch(() => deviceStore.activeWebRTCMap, (newMap) => {
  if (selectedDeviceId.value && newMap.has(selectedDeviceId.value) && !isSharedConnection) {
    // Smoothly reuse shared data channel if available
    const shared = newMap.get(selectedDeviceId.value)
    if (shared && shared !== webrtc) {
      const cur = selectedDeviceId.value
      selectedDeviceId.value = ''
      setTimeout(() => { selectedDeviceId.value = cur }, 50)
    }
  }
}, { deep: true })

watch(() => deviceStore.activeDeviceId, (newActiveId) => {
  if (newActiveId && selectedDeviceId.value !== newActiveId) {
    selectedDeviceId.value = newActiveId
  }
})

// Mark in-progress transfers as failed if file channel disconnects
watch(isFileChannelReady, (ready) => {
  if (ready) return
  Object.values(uploadSessions).forEach(session => {
    updateTransfer(session.id, { status: 'failed', progress: 100, message: 'File channel disconnected' })
    delete uploadSessions[session.destPath]
  })
  if (activeDownloadSession) {
    failDownloadSession(activeDownloadSession, 'File channel disconnected')
  }
  while (downloadQueue.length > 0) {
    const session = downloadQueue.shift()
    updateTransfer(session.id, { status: 'failed', progress: 100, message: 'File channel disconnected' })
    delete downloadSessions[session.path]
  }
  if (activeInstallSession) {
    failInstallSession(activeInstallSession, 'File channel disconnected')
  }
})

// Handle page backgrounding during mobile file selection
// Auto-reconnect file channel on returning to foreground
function onVisibilityChange() {
  if (document.visibilityState !== 'visible') return
  if (!selectedDeviceId.value || !webrtc || isSharedConnection) return
  if (['disconnected', 'error'].includes(webrtcStatus.value)) {
    webrtc.disconnect()
    webrtc.connect()
  }
}

function formatFileSize(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${Number((bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1))} ${units[index]}`
}

function formatSpeed(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec < 0) return '0 B/s'
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s']
  const index = Math.min(Math.floor(Math.log(bytesPerSec) / Math.log(1024)), units.length - 1)
  return `${Number((bytesPerSec / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1))} ${units[index]}`
}

function formatTime(seconds) {
  if (!seconds) return '-'
  return new Date(seconds * 1000).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function isApk(file) {
  return file?.name?.toLowerCase().endsWith('.apk')
}

function normalizePath(path) {
  const value = String(path || '/sdcard').trim()
  if (!value) return '/sdcard'
  return value.startsWith('/') ? value.replace(/\/+/g, '/') : `/${value}`.replace(/\/+/g, '/')
}

function joinPath(base, name) {
  return `${base.endsWith('/') ? base.slice(0, -1) : base}/${name}`
}

function refreshFileList() {
  if (!isFileChannelReady.value || !webrtc) return
  filesLoading.value = true
  webrtc.sendFileChannelCmd({ type: 'list', path: currentPath.value })
}

function applyPath() {
  currentPath.value = normalizePath(pathDraft.value)
  refreshFileList()
}

function goUpFolder() {
  const parts = currentPath.value.split('/').filter(Boolean)
  if (parts.length === 0) return
  parts.pop()
  currentPath.value = parts.length ? `/${parts.join('/')}` : '/'
  refreshFileList()
}

function onRowClick(file) {
  if (file.is_dir) {
    currentPath.value = file.path
    refreshFileList()
  }
}

function onRowDblClick(file) {
  if (!file.is_dir) downloadFile(file)
}

function showNewFolderPrompt() {
  if (!webrtc) return
  const name = prompt('Enter folder name:')
  const trimmed = name?.trim()
  if (!trimmed) return
  webrtc.sendFileChannelCmd({ type: 'mkdir', path: joinPath(currentPath.value, trimmed) })
}

function toggleFileSelection(file, force) {
  const next = new Set(selectedPaths.value)
  const checked = force ?? !next.has(file.path)
  if (checked) next.add(file.path)
  else next.delete(file.path)
  selectedPaths.value = next
}

function toggleSelectAll(checked) {
  const next = new Set(selectedPaths.value)
  sortedFiles.value.forEach(file => {
    if (checked) next.add(file.path)
    else next.delete(file.path)
  })
  selectedPaths.value = next
}

function clearSelection() {
  selectedPaths.value = new Set()
}

function setSort(key) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = key === 'name' ? 'asc' : 'desc'
  }
}

function sortMark(key) {
  if (sortKey.value !== key) return ''
  return sortDir.value === 'asc' ? '↑' : '↓'
}

function downloadSelected() {
  selectedDownloadableFiles.value.forEach(queueDownloadFile)
  startNextDownload()
}

function installSelectedApks() {
  selectedInstallableFiles.value.forEach(queueApkInstall)
  startNextInstall()
}

function deleteSelected() {
  if (!webrtc || selectedFiles.value.length === 0) return
  if (!confirm(`Delete ${selectedFiles.value.length} selected item(s)? This cannot be undone.`)) return
  selectedFiles.value.forEach(file => {
    webrtc.sendFileChannelCmd({ type: 'delete', path: file.path })
  })
  clearSelection()
}

function queueDownloadFile(file) {
  if (!webrtc || file.is_dir) return
  if (downloadSessions[file.path]) return

  const id = ++transferIdSeq
  const session = {
    id,
    name: file.name,
    path: file.path,
    chunks: [],
    loaded: 0,
    total: file.size || 0,
    started: false
  }

  activeTransfers.value.push({
    id,
    name: file.name,
    path: file.path,
    type: 'download',
    progress: 0,
    status: 'queued',
    total: session.total,
    loaded: 0
  })
  downloadSessions[file.path] = session
  downloadQueue.push(session)
}

function downloadFile(file) {
  queueDownloadFile(file)
  startNextDownload()
}

function queueApkInstall(file) {
  if (!webrtc || file.is_dir || !isApk(file)) return
  if (installSessions[file.path]) return

  const id = ++transferIdSeq
  const session = {
    id,
    name: file.name,
    path: file.path,
    total: file.size || 0,
    started: false
  }

  activeTransfers.value.push({
    id,
    name: file.name,
    path: file.path,
    type: 'install',
    progress: 0,
    status: 'queued',
    total: session.total,
    loaded: 0
  })
  installSessions[file.path] = session
  installQueue.push(session)
}

function installApkFromFile(file) {
  queueApkInstall(file)
  startNextInstall()
}

function startNextDownload() {
  if (!webrtc || activeDownloadSession) return
  const session = downloadQueue.shift()
  if (!session) return

  activeDownloadSession = session
  session.started = true
  updateTransfer(session.id, { status: 'transferring', progress: session.total === 0 ? 100 : 0 })
  const sent = webrtc.sendFileChannelCmd({
    type: 'download_start',
    path: session.path,
    request_id: String(session.id)
  })
  if (!sent) {
    failDownloadSession(session, 'File channel unavailable')
  }
}

function startNextInstall() {
  if (!webrtc || activeInstallSession) return
  const session = installQueue.shift()
  if (!session) return

  activeInstallSession = session
  session.started = true
  updateTransfer(session.id, { status: 'installing', progress: 10 })
  const sent = webrtc.sendFileChannelCmd({
    type: 'install_apk',
    path: session.path,
    request_id: String(session.id)
  })
  if (!sent) {
    failInstallSession(session, 'File channel unavailable')
  }
}

function onFileSelected(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (file) startUploadFile(file)
}

function onFileDropped(e) {
  dragOver.value = false
  const file = e.dataTransfer.files?.[0]
  if (file) startUploadFile(file)
}

async function calculateFileSHA256(file) {
  // Incremental chunk calculation to prevent memory exhaustion
  return hashFileIncremental(file)
}

async function startUploadFile(file) {
  if (!isFileChannelReady.value || !webrtc) {
    alert('File channel is not connected yet. Cannot upload.')
    return
  }
  if (hasActiveUpload.value) {
    alert('Another upload is in progress. Please wait for it to finish.')
    return
  }

  const installOnFinish = isApk(file) && confirm(`Install "${file.name}" after upload finishes?`)
  const destPath = joinPath(currentPath.value, file.name)
  const id = ++transferIdSeq
  activeTransfers.value.push({
    id,
    name: file.name,
    path: destPath,
    type: installOnFinish ? 'upload-install' : 'upload',
    progress: 0,
    status: 'checking',
    total: file.size,
    loaded: 0
  })

  let sha256Str = ''
  try {
    sha256Str = await calculateFileSHA256(file)
  } catch (err) {
    console.error('[SHA256] Failed to calculate hash:', err)
  }

  updateTransfer(id, { status: 'transferring' })

  uploadSessions[destPath] = {
    id,
    file,
    offset: 0,
    installOnFinish,
    destPath
  }
  webrtc.sendFileChannelCmd({
    type: 'upload_start',
    path: destPath,
    size: file.size,
    sha256: sha256Str,
    install_on_finish: installOnFinish
  })
}

async function sendNextChunks(session) {
  const chunkSize = 16384 // 16KB - Safe WebRTC chunk size for SCTP limits
  const file = session.file
  let yieldsCount = 0

  const startTime = Date.now()
  let lastTime = startTime
  let lastLoaded = 0

  while (session.offset < file.size) {
    if (!webrtc || !isFileChannelReady.value) break
    if (webrtc.getFileChannelBufferedAmount() > 512 * 1024) {
      await new Promise(resolve => setTimeout(resolve, 10))
      continue
    }
    const start = session.offset
    const end = Math.min(start + chunkSize, file.size)
    const arrayBuffer = await file.slice(start, end).arrayBuffer()
    if (!webrtc || !isFileChannelReady.value) break
    try {
      if (webrtc.sendFileChannelChunk(arrayBuffer)) {
        session.offset = end

        const now = Date.now()
        const elapsed = now - lastTime
        if (elapsed >= 500) {
          const bytesSent = session.offset - lastLoaded
          const speedBps = (bytesSent / elapsed) * 1000
          const speedText = formatSpeed(speedBps)
          updateTransfer(session.id, {
            loaded: end,
            progress: Math.min(Math.floor((end / file.size) * 100), 99),
            speed: speedText
          })
          lastTime = now
          lastLoaded = session.offset
        } else {
          updateTransfer(session.id, {
            loaded: end,
            progress: Math.min(Math.floor((end / file.size) * 100), 99)
          })
        }

        // Yield every 32 chunks (approx 512KB) to keep UI responsive
        yieldsCount++
        if (yieldsCount >= 32) {
          yieldsCount = 0
          await new Promise(resolve => setTimeout(resolve, 1))
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, 10))
      }
    } catch (err) {
      console.error('[FileChannel] Failed to send chunk, retrying:', err)
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }

  // Mark transfer failed if channel closes during transfer
  if (session.offset < file.size && uploadSessions[session.destPath]) {
    updateTransfer(session.id, { status: 'failed', progress: 100, message: 'File channel disconnected' })
    delete uploadSessions[session.destPath]
  }
}

function updateTransfer(id, patch) {
  const target = activeTransfers.value.find(item => item.id === id)
  if (target) Object.assign(target, patch)
}

function resetTransferState() {
  activeTransfers.value = []
  activeDownloadSession = null
  activeInstallSession = null
  downloadQueue.length = 0
  installQueue.length = 0
  Object.keys(downloadSessions).forEach(path => delete downloadSessions[path])
  Object.keys(uploadSessions).forEach(path => delete uploadSessions[path])
  Object.keys(installSessions).forEach(path => delete installSessions[path])
}

function handleFileChannelMessage(data) {
  if (data instanceof ArrayBuffer) {
    handleDownloadChunk(data)
    return
  }

  try {
    const msg = JSON.parse(data)
    switch (msg.type) {
      case 'list_reply':
        filesLoading.value = false
        if (msg.success) {
          currentPath.value = msg.path || currentPath.value
          fileList.value = msg.files || []
          selectedPaths.value = new Set([...selectedPaths.value].filter(path => fileList.value.some(file => file.path === path)))
        } else {
          alert('Failed to read file list: ' + msg.error)
        }
        break
      case 'mkdir_reply':
        msg.success ? refreshFileList() : alert('Failed to create folder: ' + msg.error)
        break
      case 'delete_reply':
        msg.success ? refreshFileList() : alert('Failed to delete: ' + msg.error)
        break
      case 'upload_reply':
        handleUploadReply(msg)
        break
      case 'upload_ack':
        handleUploadAck(msg)
        break
      case 'download_reply':
        handleDownloadReply(msg)
        break
      case 'install_status':
        handleInstallStatus(msg)
        break
    }
  } catch (e) {
    console.error('[FileChannel] Failed to parse message JSON:', e)
  }
}

function handleUploadReply(msg) {
  if (!msg.success) {
    const session = Object.values(uploadSessions)[0]
    if (session) {
      updateTransfer(session.id, { status: 'failed', progress: 100, message: msg.error })
      delete uploadSessions[session.destPath]
    }
    alert('Failed to start upload: ' + msg.error)
    return
  }
  const session = msg.path ? uploadSessions[msg.path] : Object.values(uploadSessions).find(s => s.offset === 0)
  if (session) sendNextChunks(session)
}

function handleUploadAck(msg) {
  const session = msg.path ? uploadSessions[msg.path] : Object.values(uploadSessions)[0]
  if (!session) return

  if (msg.finished && msg.success === false) {
    updateTransfer(session.id, {
      loaded: msg.uploaded ?? session.offset,
      progress: 100,
      status: 'failed',
      message: msg.error || 'Integrity check failed'
    })
    delete uploadSessions[session.destPath]
    alert('File integrity verification failed: ' + msg.error)
    return
  }

  updateTransfer(session.id, {
    loaded: msg.uploaded ?? session.offset,
    progress: msg.finished ? 100 : Math.min(Math.floor(((msg.uploaded ?? session.offset) / session.file.size) * 100), 99),
    status: msg.finished && session.installOnFinish ? 'installing' : (msg.finished ? 'success' : 'transferring')
  })

  if (msg.finished) {
    delete uploadSessions[session.destPath]
    refreshFileList()
  }
}

function handleDownloadReply(msg) {
  const requestID = Number(msg.request_id)
  const session = Number.isFinite(requestID) && requestID > 0
    ? Object.values(downloadSessions).find(item => item.id === requestID)
    : activeDownloadSession

  if (!session) return

  if (!msg.success) {
    failDownloadSession(session, msg.error || 'Unknown error')
    alert('Failed to start download: ' + msg.error)
    return
  }

  session.total = Number(msg.size ?? session.total) || 0
  updateTransfer(session.id, { total: session.total })
  if (session.total === 0) {
    finishDownloadSession(session)
  }
}

function handleDownloadChunk(data) {
  if (!activeDownloadSession) return

  activeDownloadSession.chunks.push(data)
  activeDownloadSession.loaded += data.byteLength

  const now = Date.now()
  if (!activeDownloadSession.lastTime) {
    activeDownloadSession.startTime = now
    activeDownloadSession.lastTime = now
    activeDownloadSession.lastLoaded = 0
  }
  const elapsed = now - activeDownloadSession.lastTime

  if (elapsed >= 500) {
    const bytesReceived = activeDownloadSession.loaded - activeDownloadSession.lastLoaded
    const speedBps = (bytesReceived / elapsed) * 1000
    const speedText = formatSpeed(speedBps)
    updateTransfer(activeDownloadSession.id, {
      loaded: activeDownloadSession.loaded,
      progress: Math.min(Math.floor((activeDownloadSession.loaded / activeDownloadSession.total) * 100), 99),
      speed: speedText
    })
    activeDownloadSession.lastTime = now
    activeDownloadSession.lastLoaded = activeDownloadSession.loaded
  } else {
    updateTransfer(activeDownloadSession.id, {
      loaded: activeDownloadSession.loaded,
      progress: Math.min(Math.floor((activeDownloadSession.loaded / activeDownloadSession.total) * 100), 99)
    })
  }

  if (activeDownloadSession.loaded < activeDownloadSession.total) return

  finishDownloadSession(activeDownloadSession)
}

function finishDownloadSession(session) {
  const blob = new Blob(session.chunks)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = session.name
  anchor.click()
  URL.revokeObjectURL(url)
  updateTransfer(session.id, { progress: 100, status: 'success' })
  delete downloadSessions[session.path]
  if (activeDownloadSession?.id === session.id) {
    activeDownloadSession = null
  }
  startNextDownload()
}

function failDownloadSession(session, message) {
  updateTransfer(session.id, { progress: 100, status: 'failed', message })
  delete downloadSessions[session.path]
  if (activeDownloadSession?.id === session.id) {
    activeDownloadSession = null
  }
  startNextDownload()
}

function handleInstallStatus(msg) {
  const id = Number(msg.request_id)
  let target = Number.isFinite(id) && id > 0 ? activeTransfers.value.find(item => item.id === id) : null
  if (!target && msg.path) {
    target = activeTransfers.value.find(item => item.path === msg.path && ['queued', 'installing', 'transferring'].includes(item.status))
  }
  if (!target) return

  if (msg.status === 'installing') {
    target.status = 'installing'
    target.progress = Math.max(target.progress, 60)
  } else if (msg.status === 'success') {
    target.status = 'success'
    target.progress = 100
    finishInstallSession(target)
    refreshFileList()
  } else if (msg.status === 'error') {
    target.status = 'failed'
    target.progress = 100
    target.message = msg.message
    finishInstallSession(target)
    alert(msg.message)
  }
}

function finishInstallSession(target) {
  if (target.type !== 'install') return
  delete installSessions[target.path]
  if (activeInstallSession?.id === target.id) {
    activeInstallSession = null
  }
  startNextInstall()
}

function failInstallSession(session, message) {
  updateTransfer(session.id, { progress: 100, status: 'failed', message })
  delete installSessions[session.path]
  if (activeInstallSession?.id === session.id) {
    activeInstallSession = null
  }
  startNextInstall()
}

function transferLabel(t) {
  const map = {
    upload: 'Upload',
    'upload-install': t.status === 'installing' ? 'Installing' : 'Upload',
    download: 'Download',
    install: 'Install'
  }
  if (t.status === 'queued') return 'Queued'
  if (t.status === 'checking') return 'Verifying'
  if (t.status === 'success') return 'Success'
  if (t.status === 'failed') return 'Failed'
  const speedStr = t.speed ? ` (${t.speed})` : ''
  return `${map[t.type] || 'Task'} ${t.progress}%${speedStr}`
}

function isTransferDone(t) {
  return ['success', 'failed'].includes(t.status)
}

function removeTransfer(id) {
  activeTransfers.value = activeTransfers.value.filter(item => item.id !== id)
}

function clearFinishedTransfers() {
  activeTransfers.value = activeTransfers.value.filter(item => !isTransferDone(item))
}

onMounted(() => {
  if (deviceStore.activeDeviceId) {
    selectedDeviceId.value = deviceStore.activeDeviceId
  }
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
  cleanWebRTC()
})
</script>

<style scoped>
.file-manager-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  color: #d6dde7;
  background: #0f1218;
}

.fm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 22px;
  background: #141922;
  border-bottom: 1px solid #252d39;
}

.fm-title-block {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.fm-title-icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 8px;
  color: #7cc7a7;
  background: #19251f;
  border: 1px solid #274333;
  flex: 0 0 auto;
}

.fm-title-icon svg,
.fm-title-block svg {
  width: 20px;
  height: 20px;
}

.fm-title-block h2 {
  margin: 0;
  font-size: 18px;
  line-height: 1.2;
  color: #f3f6fb;
}

.fm-title-block p {
  margin: 3px 0 0;
  font-size: 12px;
  color: #8f9aaa;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 48vw;
}

.fm-device-panel {
  display: flex;
  align-items: center;
  gap: 10px;
}

.device-select,
.path-box input {
  height: 36px;
  border: 1px solid #2c3542;
  border-radius: 8px;
  color: #e8edf5;
  background: #0f141c;
  outline: none;
}

.device-select {
  min-width: 220px;
  padding: 0 12px;
}

.connection-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 36px;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 12px;
  border: 1px solid #2c3542;
  background: #111720;
  white-space: nowrap;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #8f9aaa;
}

.connection-pill.connected .status-dot { background: #4ec98d; }
.connection-pill.connecting .status-dot { background: #e2b84d; animation: pulse 1s infinite alternate; }
.connection-pill.error .status-dot { background: #ff6b66; }

@keyframes pulse {
  from { opacity: .45; }
  to { opacity: 1; }
}

.fm-body {
  flex: 1;
  min-height: 0;
  display: flex;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 32px;
  color: #8f9aaa;
}

.empty-state svg {
  width: 54px;
  height: 54px;
  color: #7cc7a7;
  margin-bottom: 16px;
}

.empty-state h3 {
  margin: 0 0 8px;
  color: #f3f6fb;
  font-size: 18px;
}

.empty-state p {
  margin: 0 0 18px;
  max-width: 420px;
  line-height: 1.5;
}

.empty-state.error svg,
.empty-state.error h3 {
  color: #ff6b66;
}

.spinner {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 3px solid #2c3542;
  border-top-color: #7cc7a7;
  animation: spin .8s linear infinite;
  margin-bottom: 16px;
}

.spinner.small {
  width: 18px;
  height: 18px;
  border-width: 2px;
  margin: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.fm-shell {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 22px;
  border-bottom: 1px solid #252d39;
  background: #111720;
}

.icon-btn,
.upload-btn,
.secondary-btn,
.danger-btn,
.primary-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  border-radius: 8px;
  border: 1px solid #2c3542;
  color: #d6dde7;
  background: #18202b;
  cursor: pointer;
  user-select: none;
}

.icon-btn {
  width: 38px;
  flex: 0 0 auto;
}

.icon-btn:disabled,
.secondary-btn:disabled {
  opacity: .42;
  cursor: not-allowed;
}

.icon-btn svg,
.upload-btn svg {
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.path-box {
  flex: 1;
  min-width: 120px;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  padding: 0 8px 0 12px;
  border-radius: 8px;
  border: 1px solid #2c3542;
  background: #0f141c;
}

.path-box span {
  font-size: 12px;
  color: #8f9aaa;
}

.path-box input {
  flex: 1;
  min-width: 0;
  height: 30px;
  padding: 0;
  border: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.upload-btn {
  gap: 7px;
  padding: 0 14px;
  color: #092016;
  background: #7cc7a7;
  border-color: #7cc7a7;
  font-weight: 700;
}

.upload-btn.disabled {
  opacity: .5;
  cursor: not-allowed;
}

.upload-btn input {
  display: none;
}

.secondary-btn,
.danger-btn,
.primary-btn {
  padding: 0 12px;
  font-size: 13px;
}

.danger-btn {
  color: #ffd9d7;
  background: #321b1e;
  border-color: #6a3034;
}

.primary-btn {
  color: #092016;
  background: #7cc7a7;
  border-color: #7cc7a7;
  font-weight: 700;
}

.selection-bar {
  display: none;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 22px;
  border-bottom: 1px solid #253346;
  background: #14241d;
}

.selection-bar.visible {
  display: flex;
}

.selection-summary,
.selection-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.selection-summary {
  color: #9eb4c9;
  font-size: 13px;
}

.selection-summary strong {
  color: #f3f6fb;
}

.file-surface {
  flex: 1;
  position: relative;
  min-height: 0;
  overflow: auto;
}

.file-surface.drag-over {
  outline: 2px dashed #7cc7a7;
  outline-offset: -8px;
}

.drag-overlay {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: grid;
  place-items: center;
  background: rgba(15, 18, 24, .82);
  pointer-events: none;
}

.drag-overlay div {
  padding: 18px 28px;
  border-radius: 8px;
  border: 1px solid #4d8069;
  color: #bce8d3;
  background: #14241d;
}

.list-head,
.file-row {
  display: grid;
  grid-template-columns: 44px minmax(220px, 1fr) 120px 160px;
  align-items: center;
}

.list-head {
  position: sticky;
  top: 0;
  z-index: 2;
  height: 42px;
  background: #121821;
  border-bottom: 1px solid #252d39;
  color: #8f9aaa;
  font-size: 12px;
  font-weight: 700;
}

.list-head button {
  justify-self: start;
  border: 0;
  color: inherit;
  background: transparent;
  cursor: pointer;
  font: inherit;
}

.check-cell {
  display: grid;
  place-items: center;
}

.check-cell input {
  width: 16px;
  height: 16px;
  accent-color: #7cc7a7;
}

.file-row {
  min-height: 58px;
  border-bottom: 1px solid #1d2530;
}

.file-row.folder {
  cursor: pointer;
}

.file-row:hover {
  background: #151c26;
}

.file-row.selected {
  background: #14241d;
}

.file-primary {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.file-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  color: #a9b5c4;
  background: #18202b;
  border: 1px solid #2c3542;
  flex: 0 0 auto;
}

.file-icon.folder {
  color: #f0c66b;
  background: #2a2416;
  border-color: #534322;
}

.file-icon.apk {
  color: #7cc7a7;
  background: #14241d;
  border-color: #2d5a45;
}

.file-icon svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.file-text {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.file-name {
  color: #f3f6fb;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-path {
  color: #748094;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size,
.file-date {
  color: #9ba6b6;
  font-size: 13px;
}

.list-state {
  min-height: 260px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #8f9aaa;
}

.transfer-dock {
  flex-shrink: 0;
  max-height: 190px;
  overflow: auto;
  border-top: 1px solid #252d39;
  background: #111720;
}

.dock-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 22px;
  color: #8f9aaa;
  font-size: 12px;
  font-weight: 700;
}

.dock-head button {
  border: 0;
  color: #9eb4c9;
  background: transparent;
  cursor: pointer;
}

.transfer-list {
  display: grid;
  gap: 8px;
  padding: 0 22px 14px;
}

.transfer-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 160px 26px;
  align-items: center;
  gap: 12px;
  min-height: 42px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid #2c3542;
  background: #0f141c;
}

.transfer-item.success { border-color: #2d5a45; }
.transfer-item.failed { border-color: #6a3034; }

.transfer-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.transfer-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #f3f6fb;
  font-size: 13px;
}

.transfer-status {
  color: #8f9aaa;
  font-size: 12px;
}

.transfer-progress {
  height: 6px;
  border-radius: 999px;
  overflow: hidden;
  background: #252d39;
}

.transfer-progress div {
  height: 100%;
  background: #7cc7a7;
  transition: width .12s linear;
}

.transfer-item button {
  width: 24px;
  height: 24px;
  border: 0;
  color: #8f9aaa;
  background: transparent;
  cursor: pointer;
}

@media (max-width: 820px) {
  .fm-header {
    align-items: stretch;
    flex-direction: column;
    padding: 12px;
  }

  .fm-title-block p {
    max-width: 84vw;
  }

  .fm-device-panel {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .device-select {
    min-width: 0;
    width: 100%;
  }

  .toolbar {
    padding: 10px 12px;
    gap: 6px;
    flex-wrap: wrap;
  }

  .path-box {
    order: 2;
    flex-basis: 100%;
  }

  .upload-btn {
    width: 38px;
    padding: 0;
  }

  .upload-btn span {
    display: none;
  }

  .selection-bar.visible {
    align-items: stretch;
    flex-direction: column;
    padding: 10px 12px;
  }

  .selection-actions {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
  }

  .selection-actions button {
    min-width: 0;
    padding: 0 6px;
  }

  .list-head {
    display: none;
  }

  .file-list {
    padding: 8px;
  }

  .file-row {
    grid-template-columns: 36px minmax(0, 1fr);
    grid-template-areas:
      "check primary"
      "check meta";
    align-items: center;
    min-height: 72px;
    margin-bottom: 8px;
    border: 1px solid #252d39;
    border-radius: 8px;
    background: #111720;
  }

  .file-row .check-cell { grid-area: check; }
  .file-primary { grid-area: primary; padding-right: 10px; }
  .file-size {
    grid-area: meta;
    padding-left: 46px;
  }
  .file-date {
    display: none;
  }

  .file-path {
    display: none;
  }

  .transfer-item {
    grid-template-columns: minmax(0, 1fr) 80px 24px;
  }
}
</style>
