export const defaultSettings = {
  fps: 0,
  size: 0,
  bitrate: 4,
  bwe: true,
  minBitrate: 8,
  maxBitrate: 20,
  audio: false,
  audioGain: 1,
  audioSource: 'output',
  audioDup: true,
  audioLowLatency: false,
  pageAudioMuted: false,
  debug: false,
  snapshotInterval: 10,
  powerOff: false,
  connectionPath: 'auto',
  ipPreference: 'auto',
  showStats: true,
  videoCodecOptions: '',
  camera: false,
  previewFps: 10,
  previewSize: 360,
  previewDecoder: 'wasm',
  previewBitrate: 1,
  renderEngine: 'webcodecs',
  stayAwake: false,
  videoSource: 'display',
  cameraFacing: 'back',
  cameraId: '',
  cameraSize: '',
  cameraFps: 0,
  cameraHighSpeed: false,
  cameraAr: ''
}

function parseSettings(parsed) {
  const hasAudioDup = Object.prototype.hasOwnProperty.call(parsed, 'audioDup')
  if (parsed.bitrate > 1000) {
    parsed.bitrate = Math.max(0.1, Math.round(parsed.bitrate / 100000) / 10)
    if (parsed.minBitrate > 1000) parsed.minBitrate = Math.max(1, Math.round(parsed.minBitrate / 1000000))
    if (parsed.maxBitrate > 1000) parsed.maxBitrate = Math.max(1, Math.round(parsed.maxBitrate / 1000000))
  }
  if (parsed.previewBitrate > 1000) {
    parsed.previewBitrate = Math.max(1, Math.round(parsed.previewBitrate / 1000000))
  }
  if (parsed.audioGain === undefined) parsed.audioGain = defaultSettings.audioGain
  if (parsed.audioSource === undefined) parsed.audioSource = defaultSettings.audioSource
  if (!hasAudioDup && parsed.audioSource === 'output') parsed.audioSource = defaultSettings.audioSource
  if (parsed.audioDup === undefined) parsed.audioDup = defaultSettings.audioDup
  if (parsed.pageAudioMuted === undefined) parsed.pageAudioMuted = defaultSettings.pageAudioMuted
  if (parsed.debug === undefined) parsed.debug = defaultSettings.debug
  if (parsed.snapshotInterval === undefined) parsed.snapshotInterval = defaultSettings.snapshotInterval
  if (parsed.powerOff === undefined) parsed.powerOff = defaultSettings.powerOff
  if (parsed.connectionPath === undefined) parsed.connectionPath = defaultSettings.connectionPath
  if (parsed.ipPreference === undefined) parsed.ipPreference = defaultSettings.ipPreference
  if (parsed.showStats === undefined) parsed.showStats = defaultSettings.showStats
  if (parsed.videoCodecOptions === undefined) parsed.videoCodecOptions = defaultSettings.videoCodecOptions
  if (parsed.camera === undefined) parsed.camera = defaultSettings.camera
  if (parsed.previewFps === undefined) parsed.previewFps = defaultSettings.previewFps
  if (parsed.previewSize === undefined) parsed.previewSize = defaultSettings.previewSize
  if (parsed.previewDecoder === undefined) parsed.previewDecoder = defaultSettings.previewDecoder
  if (parsed.previewBitrate === undefined) parsed.previewBitrate = defaultSettings.previewBitrate
  if (parsed.renderEngine === undefined) parsed.renderEngine = defaultSettings.renderEngine
  if (parsed.stayAwake === undefined) parsed.stayAwake = defaultSettings.stayAwake
  if (parsed.videoSource === undefined) parsed.videoSource = defaultSettings.videoSource
  if (parsed.cameraFacing === undefined) parsed.cameraFacing = defaultSettings.cameraFacing
  if (parsed.cameraId === undefined) parsed.cameraId = defaultSettings.cameraId
  if (parsed.cameraSize === undefined) parsed.cameraSize = defaultSettings.cameraSize
  if (parsed.cameraFps === undefined) parsed.cameraFps = defaultSettings.cameraFps
  if (parsed.cameraHighSpeed === undefined) parsed.cameraHighSpeed = defaultSettings.cameraHighSpeed
  if (parsed.cameraAr === undefined) parsed.cameraAr = defaultSettings.cameraAr
  return parsed
}

export function getDeviceSettings(deviceId) {
  let globalSettings = { ...defaultSettings }
  try {
    const storedGlobal = localStorage.getItem('cloudphone_settings')
    if (storedGlobal) {
      globalSettings = { ...globalSettings, ...parseSettings(JSON.parse(storedGlobal)) }
      globalSettings.videoSource = 'display'
      localStorage.setItem('cloudphone_settings', JSON.stringify(globalSettings))
    }
  } catch(e) {}

  if (!deviceId) return globalSettings

  try {
    const storedDev = localStorage.getItem(`cloudphone_settings_${deviceId}`)
    if (storedDev) {
      const devSettings = { ...globalSettings, ...parseSettings(JSON.parse(storedDev)) }
      // In persistent config, videoSource is always 'display' by default to avoid accidental camera connection
      devSettings.videoSource = 'display'
      return devSettings
    }
  } catch(e) {}
  
  return globalSettings
}

export function saveDeviceSettings(deviceId, newSettings) {
  // When persisting settings, videoSource defaults to 'display', activated dynamically at runtime
  const settingsToStore = { ...newSettings, videoSource: 'display' }
  if (!deviceId) {
    localStorage.setItem('cloudphone_settings', JSON.stringify(settingsToStore))
    fetch('/api/default_settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settingsToStore)
    }).catch(err => console.warn('Failed to sync global settings to server:', err))
  } else {
    localStorage.setItem(`cloudphone_settings_${deviceId}`, JSON.stringify(settingsToStore))
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cloudphone-settings-updated', { detail: { deviceId } }))
  }
}

export function hasCustomSettings(deviceId) {
  if (!deviceId) return false
  return localStorage.getItem(`cloudphone_settings_${deviceId}`) !== null
}

export function deleteDeviceSettings(deviceId) {
  if (deviceId) {
    localStorage.removeItem(`cloudphone_settings_${deviceId}`)
    localStorage.removeItem(`cloudphone_camera_pref_${deviceId}`)
  }
}

// --- Camera monitoring preferences (isolated per device, independent of screen streaming config) ---
export const defaultCameraPreferences = {
  cameraFacing: 'back',
  cameraId: '',
  cameraSize: '1920x1080',
  cameraFps: 30,
  cameraZoomRatio: 1.0,
  cameraOrientation: 'auto',
  audioSource: 'mic'
}

export function getCameraPreferences(deviceId) {
  let pref = { ...defaultCameraPreferences }
  if (!deviceId) return pref
  try {
    const stored = localStorage.getItem(`cloudphone_camera_pref_${deviceId}`)
    if (stored) {
      pref = { ...pref, ...JSON.parse(stored) }
      // Clean invalid camera IDs to prevent scrcpy camera crashes
      if (pref.cameraId && pref.cameraId !== '0' && pref.cameraId !== '1') {
        pref.cameraId = ''
      }
    }
  } catch (e) {}
  return pref
}

export function saveCameraPreferences(deviceId, pref) {
  if (!deviceId) return
  try {
    const current = getCameraPreferences(deviceId)
    const updated = { ...current, ...pref }
    localStorage.setItem(`cloudphone_camera_pref_${deviceId}`, JSON.stringify(updated))
  } catch (e) {}
}

// --- User-level policy control (configured by admin in user management, enforced by server) ---

// Dimension mapping -> settings keys
export const POLICY_DIM_KEYS = {
  bitrate: ['bitrate', 'minBitrate', 'maxBitrate', 'bwe'],
  fps: ['fps'],
  resolution: ['size'],
  audio: ['audio', 'audioGain', 'audioSource', 'audioDup', 'audioLowLatency']
}

// policy(authStore.userPolicy) -> SettingsModal lockedSections array
export function policyLockedSections(policy) {
  if (!policy) return []
  const arr = []
  if (policy.forbid_bitrate) arr.push('bitrate')
  if (policy.forbid_fps) arr.push('fps')
  if (policy.forbid_resolution) arr.push('size')
  if (policy.forbid_audio) arr.push('audio')
  return arr
}

// Overlay policy onto local settings: forbidden dimensions use admin configured values
// (If not set, retain local display value; server will strip and fall back to device default)
export function applyPolicyToSettings(settings, policy) {
  if (!policy) return settings
  const enforced = policy.settings || {}
  const merged = { ...settings }
  const applyDim = (forbidden, keys) => {
    if (!forbidden) return
    for (const k of keys) {
      if (enforced[k] !== undefined) merged[k] = enforced[k]
    }
  }
  applyDim(policy.forbid_bitrate, POLICY_DIM_KEYS.bitrate)
  applyDim(policy.forbid_fps, POLICY_DIM_KEYS.fps)
  applyDim(policy.forbid_resolution, POLICY_DIM_KEYS.resolution)
  applyDim(policy.forbid_audio, POLICY_DIM_KEYS.audio)
  return merged
}
