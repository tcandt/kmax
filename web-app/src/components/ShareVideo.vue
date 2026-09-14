<template>
  <div class="share-video-container" ref="containerRef">
    <!-- WebCodecs ultra-low-latency canvas -->
    <canvas
      v-show="isWebCodecs"
      ref="canvasEl"
      class="share-video"
      @click="onVideoAreaClick"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseLeave"
      @touchstart.prevent="onTouchStart"
      @touchmove.prevent="onTouchMove"
      @touchend.prevent="onTouchEnd"
      @wheel.prevent="onWheel"
      @contextmenu.prevent
    ></canvas>

    <!-- HTML5 video stream (fallback mode) -->
    <video
      v-show="!isWebCodecs"
      ref="videoEl"
      class="share-video"
      autoplay
      playsinline
      webkit-playsinline
      disableremoteplayback
      controlslist="nodownload nofullscreen noremoteplayback noplaybackrate"
      x-webkit-airplay="deny"
      :muted="!soundOn"
      @click="onVideoAreaClick"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseLeave"
      @touchstart.prevent="onTouchStart"
      @touchmove.prevent="onTouchMove"
      @touchend.prevent="onTouchEnd"
      @wheel.prevent="onWheel"
      @contextmenu.prevent
    ></video>

    <!-- Sound toggle: click anywhere on video to unmute -->

    <!-- Connecting / waiting for signaling -->
    <div v-if="showConnecting" class="state-overlay">
      <div v-if="connMetaText" class="conn-meta">{{ connMetaText }}</div>
      <div class="loading-spinner"></div>
      <p class="state-text">{{ statusText }}</p>
    </div>

    <!-- Error / Disconnected -->
    <div v-else-if="showError" class="state-overlay">
      <div class="error-icon">⚠️</div>
      <p class="state-text error-text">{{ errorText }}</p>
      <button class="btn-reconnect" @click="reconnect">🔄 Reconnect</button>
    </div>

    <!-- Fullscreen click mask when floating menu is open -->
    <div v-if="showFabMenu" class="fab-overlay" @mousedown.stop.prevent="showFabMenu = false" @touchstart.stop.prevent="showFabMenu = false"></div>

    <!-- Floating action button and menu -->
    <div v-show="isConnected" class="fab-container" :style="fabStyle">
      <button class="fab-main" :class="{ 'active': showFabMenu }"
        @mousedown="onFabStart" @mousemove="onFabMove" @mouseup="onFabEnd" @mouseleave="onFabEnd"
        @touchstart.prevent="onFabStart" @touchmove.prevent="onFabMove" @touchend.prevent="onFabEnd">
        <svg v-if="showFabMenu" class="icon" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        <svg v-else class="icon" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
      </button>

      <div class="fab-menu" :class="{ 'show': showFabMenu, 'align-left': isFabOnLeft, 'align-top': isFabOnTop }">
        <template v-if="!isViewOnly">
          <button class="fab-item" @click="quickKey(26)">
            <svg class="icon" viewBox="0 0 24 24"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg> Power
          </button>
          <button class="fab-item" @click="quickKey(3)">
            <svg class="icon" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg> Home
          </button>
          <button class="fab-item" @click="quickKey(4)">
            <svg class="icon" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"></path></svg> Back
          </button>
          <button class="fab-item" @click="quickKey(187)">
            <svg class="icon" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg> Recents
          </button>
          <button class="fab-item" @click="quickKey(24)">
            <svg class="icon" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="19" y1="9" x2="19" y2="15"></line><line x1="16" y1="12" x2="22" y2="12"></line></svg> Vol+
          </button>
          <button class="fab-item" @click="quickKey(25)">
            <svg class="icon" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="19" y1="12" x2="15" y2="12"></line><line x1="16" y1="12" x2="22" y2="12"></line></svg> Vol-
          </button>
          <div class="fab-divider"></div>
        </template>

        <button class="fab-item" @click="togglePageMute">
          <svg v-if="!localSettings.audio || !soundOn" class="icon" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
          <svg v-else class="icon" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15 9a5 5 0 0 1 0 6"></path><path d="M17.7 6.3a9 9 0 0 1 0 11.4"></path></svg>
          {{ (!localSettings.audio || !soundOn) ? 'Unmute' : 'Mute' }}
        </button>
        <button class="fab-item" @click="openSettings">
          <svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg> Settings
        </button>

        <div class="fab-divider"></div>
        <button class="fab-item" @click="onToggleFullscreen">
          <svg class="icon" viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
          {{ isFullscreen ? 'Exit Fullscreen' : 'Fullscreen' }}
        </button>
        <button v-if="!isMobile" class="fab-item" @click="onToggleWebFullscreen">
          <svg class="icon" viewBox="0 0 24 24"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
          {{ isWebFullscreen ? 'Exit Web Fullscreen' : 'Web Fullscreen' }}
        </button>
        <button v-if="!isMobile && pictureInPictureSupported" class="fab-item" @click="onTogglePictureInPicture">
          <svg class="icon" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><rect x="11" y="9" width="9" height="7" rx="1" ry="1" fill="currentColor" stroke="none"></rect></svg>
          {{ isPiP ? 'Exit PiP' : 'Picture-in-Picture' }}
        </button>
      </div>
    </div>

    <!-- Embed settings panel -->
    <SettingsModal
      v-if="showSettingsModal"
      :settings="localSettings"
      :is-connected="isConnected"
      :is-global="false"
      :is-custom="hasCustomShareSettings"
      :camera-support="cameraSupport"
      :locked-sections="lockedSections"
      :show-preview-tab="false"
      @close="showSettingsModal = false"
      @save="saveSettings"
      @reset="resetSettings"
    />
  </div>
</template>

<script setup>
import { ref, shallowRef, computed, onMounted, onUnmounted, watch } from 'vue'
import { useWebRTC } from '@/composables/useWebRTC'
import { defaultSettings } from '@/utils/settings'
import SettingsModal from '@/components/SettingsModal.vue'

const props = defineProps({
  deviceId: { type: String, required: true },
  shareToken: { type: String, default: '' },
  sharePassword: { type: String, default: '' },
  accessMode: { type: String, default: 'full' },
  // Granular permissions enforced by signaling server
  forbidBitrate: { type: Boolean, default: false },
  forbidFps: { type: Boolean, default: false },
  forbidResolution: { type: Boolean, default: false },
  forbidAudio: { type: Boolean, default: false },
  // Guest settings preset configured by sharer
  guestSettings: { type: Object, default: null },
  // Remaining validity in seconds (-1 = permanent)
  cardCode: { type: String, default: '' },
  remainingSeconds: { type: Number, default: -1 }
})

const isViewOnly = computed(() => props.accessMode === 'view_only')

// Locked settings partition in SettingsModal
const lockedSections = computed(() => {
  const arr = []
  if (props.forbidBitrate) arr.push('bitrate')
  if (props.forbidFps) arr.push('fps')
  if (props.forbidResolution) arr.push('size')
  if (props.forbidAudio) arr.push('audio')
  return arr
})

const videoEl = ref(null)
const canvasEl = ref(null)
// Sound toggle: default muted for autoplay compliance; unmute on user gesture
const soundOn = ref(false)
const showSettingsModal = ref(false)
const cameraSupport = ref(true)

// Guest local settings schema
const shareSettingsKey = computed(() => `cloudphone_share_settings_${props.deviceId}`)
const shareDefaults = { ...defaultSettings, audio: true }

// Ignore guest local values for locked settings dimensions
const DIM_KEYS = {
  bitrate: ['bitrate', 'minBitrate', 'maxBitrate', 'bwe'],
  fps: ['fps'],
  resolution: ['size'],
  audio: ['audio', 'audioGain', 'audioSource', 'audioDup', 'audioLowLatency']
}

function loadShareSettings() {
  // Server-enforced config takes precedence
  const base = { ...shareDefaults, ...(props.guestSettings || {}) }
  try {
    const stored = JSON.parse(localStorage.getItem(shareSettingsKey.value) || 'null')
    if (stored && typeof stored === 'object') {
      const forbidden = new Set()
      if (props.forbidBitrate) DIM_KEYS.bitrate.forEach(k => forbidden.add(k))
      if (props.forbidFps) DIM_KEYS.fps.forEach(k => forbidden.add(k))
      if (props.forbidResolution) DIM_KEYS.resolution.forEach(k => forbidden.add(k))
      if (props.forbidAudio) DIM_KEYS.audio.forEach(k => forbidden.add(k))
      for (const [k, v] of Object.entries(stored)) {
        if (!forbidden.has(k)) base[k] = v
      }
    }
  } catch (e) {}
  return base
}

const localSettings = ref(loadShareSettings())
const hasCustomShareSettings = computed(() => localStorage.getItem(shareSettingsKey.value) !== null)

// WebRTC connection logic
const webrtc = shallowRef(null)
const isWebCodecs = computed(() => Boolean(webrtc.value?.isWebCodecsActive?.value))
const status = ref('disconnected')
const error = ref(null)
let stopWatchers = []

function buildOptions() {
  const s = localSettings.value
  return {
    view_only: isViewOnly.value,
    max_fps: s.fps,
    max_size: s.size,
    bitrate: s.bitrate * 1000000,
    min_bitrate: (s.minBitrate || 8) * 1000000,
    max_bitrate: (s.maxBitrate || 20) * 1000000,
    bwe: s.bwe,
    audio: s.audio,
    audio_gain: s.audioGain,
    audio_source: s.audioSource,
    audio_dup: s.audioDup,
    audio_low_latency: s.audioLowLatency,
    power_off: s.powerOff,
    video_source: s.videoSource,
    camera_facing: s.cameraFacing,
    camera_id: s.cameraId,
    camera_size: s.cameraSize,
    camera_fps: s.cameraFps,
    camera_high_speed: s.cameraHighSpeed,
    camera_ar: s.cameraAr
  }
}

function createConnection() {
  destroyConnection()
  const inst = useWebRTC(props.deviceId, buildOptions())
  webrtc.value = inst
  stopWatchers = [
    watch(inst.status, v => { status.value = v || 'disconnected' }, { immediate: true }),
    watch(inst.error, v => { error.value = v }, { immediate: true }),
    watch(inst.cameraSupport, v => { cameraSupport.value = v !== false }, { immediate: true })
  ]
  inst.setVideoGetter(() => videoEl.value)
  inst.setCanvasGetter(() => canvasEl.value)
  inst.connect(props.shareToken, props.sharePassword)
}

function destroyConnection() {
  stopWatchers.forEach(stop => stop())
  stopWatchers = []
  if (webrtc.value) {
    webrtc.value.disconnect()
    webrtc.value = null
  }
}

// Full reload on reconnect
function reconnect() {
  window.location.reload()
}

// SettingsModal callbacks
function saveSettings(newSettings) {
  localSettings.value = newSettings
  try {
    localStorage.setItem(shareSettingsKey.value, JSON.stringify(newSettings))
  } catch (e) {}
  // Reconnect via full page reload to ensure clean state
  window.location.reload()
}

function resetSettings() {
  localStorage.removeItem(shareSettingsKey.value)
  window.location.reload()
}

function openSettings() {
  showFabMenu.value = false
  showSettingsModal.value = true
}

// Local audio playback control
function enableSound() {
  if (!videoEl.value || !localSettings.value.audio) return
  soundOn.value = true
  videoEl.value.muted = false
  videoEl.value.play().catch(() => {})
}

function onVideoAreaClick() {
  // Unmute on first user interaction
  if (!soundOn.value) enableSound()
}

function togglePageMute() {
  showFabMenu.value = false
  if (soundOn.value) {
    soundOn.value = false
    if (videoEl.value) videoEl.value.muted = true
  } else {
    enableSound()
  }
}

const isConnected = computed(() => status.value === 'connected')
const showConnecting = computed(() =>
  !error.value && ['connecting', 'signaling', 'waiting_offer', 'connecting_webrtc'].includes(status.value)
)
const showError = computed(() => !!error.value || status.value === 'error' || status.value === 'disconnected')
const statusText = computed(() => {
  switch (status.value) {
    case 'signaling': return 'Signaling connected, negotiating parameters...'
    case 'waiting_offer': return 'Waiting for device stream...'
    case 'connecting_webrtc': return 'Connecting P2P video channel...'
    default: return 'Connecting to device...'
  }
})
const errorText = computed(() => error.value || 'Disconnected')

// Guest remaining validity overlay
const connMetaText = computed(() => {
  let text = props.cardCode ? `🔑 ${props.cardCode}` : ''
  const sec = props.remainingSeconds
  let remain = ''
  if (sec < 0) {
    remain = '♾️ Never Expires'
  } else if (sec > 0) {
    const d = Math.floor(sec / 86400)
    const h = Math.floor((sec % 86400) / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = Math.floor(sec % 60)
    if (d > 0) remain = `${d}d ${h}h left`
    else if (h > 0) remain = `${h}h ${m}m left`
    else if (m > 0) remain = `${m}m ${s}s left`
    else remain = `${s}s left`
  }
  if (remain) text = text ? `${text} · ${remain}` : remain
  return text
})

// Floating FAB controls
const showFabMenu = ref(false)
const fabStyle = ref({ right: '24px', bottom: '24px' })
const isFabOnLeft = ref(false)
const isFabOnTop = ref(false)
let isDragging = false
let dragStartTime = 0
let startX = 0
let startY = 0
let fabPressed = false

function onFabStart(e) {
  fabPressed = true
  isDragging = false
  dragStartTime = Date.now()
  const ev = e.touches ? e.touches[0] : e
  startX = ev.clientX
  startY = ev.clientY
}

function onFabMove(e) {
  if (!dragStartTime) return
  const ev = e.touches ? e.touches[0] : e
  const dx = ev.clientX - startX
  const dy = ev.clientY - startY
  if (!isDragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
    isDragging = true
  }
  if (isDragging) {
    let left = ev.clientX - 28
    let top = ev.clientY - 28
    if (left < 0) left = 0
    if (top < 0) top = 0
    if (left > window.innerWidth - 56) left = window.innerWidth - 56
    if (top > window.innerHeight - 56) top = window.innerHeight - 56
    isFabOnLeft.value = left < window.innerWidth / 2
    isFabOnTop.value = top < window.innerHeight / 2
    fabStyle.value = { left: left + 'px', top: top + 'px' }
  }
}

function onFabEnd(e) {
  // Ignore mouseout as click to prevent premature menu closing
  if (e.type === 'mouseleave') {
    if (fabPressed) {
      isDragging = false
      dragStartTime = 0
      fabPressed = false
    }
    return
  }
  // Toggle menu on tap without drag
  const wasDragging = isDragging
  isDragging = false
  dragStartTime = 0
  fabPressed = false
  if (!wasDragging) {
    showFabMenu.value = !showFabMenu.value
  }
}

// Android key injection
function quickKey(keycode) {
  showFabMenu.value = false
  if (isViewOnly.value || !webrtc.value) return
  webrtc.value.sendInjectKeycode(0, keycode)
  webrtc.value.sendInjectKeycode(1, keycode)
}

// Fullscreen / Web Fullscreen / PiP
const containerRef = ref(null)
const isFullscreen = ref(false)
const isWebFullscreen = ref(false)
const isMobile = ref(window.innerWidth <= 1024)

function updateMedia() {
  isMobile.value = window.innerWidth <= 1024
}

// Fallback for iOS webkit fullscreen
const nativeFullscreenSupported = ref(!!document.fullscreenEnabled)

function onToggleFullscreen() {
  showFabMenu.value = false
  if (!nativeFullscreenSupported.value) {
    onToggleWebFullscreen()
    return
  }
  if (!document.fullscreenElement) {
    // Exit web fullscreen before system fullscreen
    if (isWebFullscreen.value) {
      document.body.classList.remove('web-fullscreen')
      isWebFullscreen.value = false
    }
    containerRef.value?.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}

function onToggleWebFullscreen() {
  showFabMenu.value = false
  if (!isWebFullscreen.value) {
    // Exit system fullscreen first
    if (document.fullscreenElement) {
      document.exitFullscreen()
    }
    document.body.classList.add('web-fullscreen')
    isWebFullscreen.value = true
  } else {
    document.body.classList.remove('web-fullscreen')
    isWebFullscreen.value = false
  }
}

const pictureInPictureSupported = computed(() => {
  return !!('documentPictureInPicture' in window) || !!document.pictureInPictureEnabled
})
const isPiP = ref(false)
let pipWindow = null

async function onTogglePictureInPicture() {
  showFabMenu.value = false
  if (!videoEl.value) return

  // Exit existing PiP
  if (isPiP.value) {
    if (pipWindow) {
      pipWindow.close()
    } else if (document.pictureInPictureElement) {
      await document.exitPictureInPicture()
    }
    isPiP.value = false
    return
  }

  // Prefer Document PiP to keep interactions
  if ('documentPictureInPicture' in window) {
    try {
      const video = videoEl.value
      const vw = video.videoWidth || 480
      const vh = video.videoHeight || 854
      const scale = Math.min(400 / vw, 700 / vh, 1)
      const pipW = Math.round(vw * scale)
      const pipH = Math.round(vh * scale)

      pipWindow = await window.documentPictureInPicture.requestWindow({
        width: pipW,
        height: pipH,
      })

      const styles = document.querySelectorAll('style, link[rel="stylesheet"]')
      styles.forEach(s => {
        pipWindow.document.head.appendChild(s.cloneNode(true))
      })

      const pipStyle = pipWindow.document.createElement('style')
      pipStyle.textContent = `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #000; overflow: hidden; width: 100%; height: 100vh; display: flex; align-items: center; justify-content: center; }
        .pip-video-container { width: 100%; height: 100%; position: relative; display: flex; align-items: center; justify-content: center; }
        video { width: 100%; height: 100%; object-fit: contain; display: block; }
      `
      pipWindow.document.head.appendChild(pipStyle)

      const container = pipWindow.document.createElement('div')
      container.className = 'pip-video-container'
      container.appendChild(video)
      pipWindow.document.body.appendChild(container)

      isPiP.value = true

      // Restore video element when PiP closes
      pipWindow.addEventListener('pagehide', () => {
        const mainContainer = containerRef.value
        if (mainContainer && video) {
          mainContainer.insertBefore(video, mainContainer.firstChild)
        }
        isPiP.value = false
        pipWindow = null
      })

      return
    } catch (err) {
      console.warn('Document PiP failed, falling back to standard PiP:', err)
      pipWindow = null
    }
  }

  // Fallback to standard PiP (view only)
  try {
    await videoEl.value.requestPictureInPicture()
    isPiP.value = true
    videoEl.value.addEventListener('leavepictureinpicture', () => {
      isPiP.value = false
    }, { once: true })
  } catch (err) {
    console.error('PiP error:', err)
  }
}

function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
}

// Touch, mouse, and wheel input injection
let mouseDown = false

function onMouseDown(e) {
  if (isViewOnly.value || !webrtc.value) return
  if (e.button === 1) { // Middle click -> HOME
    webrtc.value.sendInjectKeycode(0, 3)
    e.preventDefault()
    return
  }
  if (e.button === 2) { // Right click -> BACK
    webrtc.value.sendInjectKeycode(0, 4)
    e.preventDefault()
    return
  }
  mouseDown = true
  webrtc.value.sendTouch(0, e.clientX, e.clientY, -1)
  e.preventDefault()
}

function onMouseMove(e) {
  if (isViewOnly.value || !mouseDown || !webrtc.value) return
  webrtc.value.sendTouch(2, e.clientX, e.clientY, -1)
}

function onMouseUp(e) {
  if (isViewOnly.value || !webrtc.value) return
  if (e.button === 1) {
    webrtc.value.sendInjectKeycode(1, 3)
    e.preventDefault()
    return
  }
  if (e.button === 2) {
    webrtc.value.sendInjectKeycode(1, 4)
    e.preventDefault()
    return
  }
  if (!mouseDown) return
  mouseDown = false
  webrtc.value.sendTouch(1, e.clientX, e.clientY, -1)
}

function onMouseLeave(e) {
  if (isViewOnly.value || !mouseDown || !webrtc.value) return
  mouseDown = false
  webrtc.value.sendTouch(1, e.clientX, e.clientY, -1)
}

function onTouchStart(e) {
  if (isViewOnly.value || !webrtc.value) return
  for (const t of e.changedTouches) {
    webrtc.value.sendTouch(0, t.clientX, t.clientY, t.identifier)
  }
}

function onTouchMove(e) {
  if (isViewOnly.value || !webrtc.value) return
  for (const t of e.changedTouches) {
    webrtc.value.sendTouch(2, t.clientX, t.clientY, t.identifier)
  }
}

function onTouchEnd(e) {
  if (isViewOnly.value || !webrtc.value) return
  for (const t of e.changedTouches) {
    webrtc.value.sendTouch(1, t.clientX, t.clientY, t.identifier)
  }
}

function wheelDeltaToScroll(delta) {
  if (!delta) return 0
  const magnitude = Math.max(1, Math.min(16, Math.round(Math.abs(delta) / 8)))
  return -Math.sign(delta) * magnitude
}

function onWheel(e) {
  if (isViewOnly.value || !webrtc.value) return
  const scrollV = wheelDeltaToScroll(e.deltaY)
  const scrollH = wheelDeltaToScroll(e.deltaX)
  if (!scrollV && !scrollH) return
  webrtc.value.sendScroll(e.clientX, e.clientY, scrollH, scrollV)
}

onMounted(() => {
  createConnection()
  document.addEventListener('fullscreenchange', onFullscreenChange)
  window.addEventListener('resize', updateMedia)
})

onUnmounted(() => {
  destroyConnection()
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  window.removeEventListener('resize', updateMedia)
  if (isWebFullscreen.value) {
    document.body.classList.remove('web-fullscreen')
  }
  if (pipWindow) {
    pipWindow.close()
    pipWindow = null
  }
})
</script>

<style scoped>
.share-video-container {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Web fullscreen */
.web-fullscreen .share-video-container {
  position: fixed;
  inset: 0;
  z-index: 2500;
}

.share-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}

.state-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(10, 12, 20, 0.75);
  color: #94a3b8;
  z-index: 10;
}

.loading-spinner {
  width: 42px;
  height: 42px;
  border: 4px solid rgba(56, 189, 248, 0.1);
  border-top-color: #38bdf8;
  border-radius: 50%;
  animation: spin 1s infinite linear;
  margin-bottom: 14px;
}

.conn-meta {
  font-size: 0.78rem;
  color: #64748b;
  margin-bottom: 14px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.state-text {
  font-size: 0.92rem;
}

.error-icon {
  font-size: 2.5rem;
  margin-bottom: 10px;
}

.error-text {
  color: #f43f5e;
  margin-bottom: 16px;
}

.btn-reconnect {
  padding: 9px 22px;
  background: linear-gradient(135deg, #0284c7, #6366f1);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
}

/* Floating FAB */
.fab-overlay {
  position: absolute;
  inset: 0;
  z-index: 25;
}

.fab-container {
  position: absolute;
  z-index: 30;
}

.fab-main {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid rgba(56, 189, 248, 0.35);
  color: #38bdf8;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  user-select: none;
  touch-action: none;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
  transition: background 0.15s;
}

.fab-main.active,
.fab-main:hover {
  background: rgba(2, 132, 199, 0.5);
}

.fab-main .icon {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.fab-menu {
  position: absolute;
  bottom: 58px;
  right: 0;
  min-width: 132px;
  padding: 6px;
  background: rgba(15, 23, 42, 0.92);
  border: 1px solid rgba(56, 189, 248, 0.25);
  border-radius: 12px;
  backdrop-filter: blur(6px);
  display: none;
  flex-direction: column;
  gap: 2px;
}

.fab-menu.show {
  display: flex;
}

.fab-menu.align-left {
  right: auto;
  left: 0;
}

.fab-menu.align-top {
  bottom: auto;
  top: 58px;
}

.fab-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: #cbd5e1;
  font-size: 0.86rem;
  cursor: pointer;
  white-space: nowrap;
  text-align: left;
  transition: background 0.15s, color 0.15s;
}

.fab-item:hover {
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
}

.fab-item .icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.fab-divider {
  height: 1px;
  background: rgba(148, 163, 184, 0.2);
  margin: 4px 6px;
}
</style>
