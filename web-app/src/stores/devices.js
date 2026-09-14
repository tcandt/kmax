import { defineStore } from 'pinia'
import { ref, computed, shallowRef, markRaw } from 'vue'
import { debugLog } from '@/utils/debug'
import { useTagStore } from './tags'

export const useDeviceStore = defineStore('devices', () => {
  const devices = ref([])
  const loading = ref(false)
  const error = ref(null)

  const isLicenseExpired = ref(false)
  const licenseErrorMsg = ref('')
  const globalMachineID = ref('')
  const licenseMaxDevices = ref(50)
  const licenseExpiresAt = ref('')
  const licenseDaysRemaining = ref(0)
  const licenseStatus = ref('valid')
  const licenseActivated = ref(false)          // Whether valid verified license exists
  const licenseCustomer = ref('')              // Customer name when activated
  const licenseCurrentDevices = ref(0)         // Current online device count (server reported)
  const licensePromo = ref(false)              // Unactivated and in promotional period
  const licensePostPromoMaxDevices = ref(10)   // Free quota after promotion ends

  const onlineDevices = computed(() => 
    [...devices.value]
      .filter(d => d.status === 'online')
      .sort((a, b) => a.id.localeCompare(b.id)) // Stable ascending sort
  )

  const offlineDevices = ref([])

  // --- Header share and view control state ---
  const searchQuery = ref('')
  const cardSize = ref(Number(localStorage.getItem('cloudphone_card_size') || 200))
  const viewMode = ref(localStorage.getItem('cloudphone_view_mode') || 'grid') // 'grid' | 'table'
  const showLicenseModal = ref(false)
  const showGlobalSettingsModal = ref(false)
  const showTagManagerModal = ref(false)

  function setCardSize(size) {
    cardSize.value = Number(size)
    localStorage.setItem('cloudphone_card_size', String(size))
  }

  function setViewMode(mode) {
    viewMode.value = mode
    localStorage.setItem('cloudphone_view_mode', mode)
  }

  function toggleViewMode() {
    setViewMode(viewMode.value === 'grid' ? 'table' : 'grid')
  }

  // --- License usage and badge computed properties ---
  const licenseUsedCount = computed(() => licenseCurrentDevices.value || onlineDevices.value.length)
  const licenseUsagePercent = computed(() => {
    if (!licenseMaxDevices.value || licenseMaxDevices.value <= 0) return 0
    return Math.round((licenseUsedCount.value / licenseMaxDevices.value) * 100)
  })

  const licenseBadgeText = computed(() => {
    const used = licenseUsedCount.value
    const max = licenseMaxDevices.value
    if (licenseActivated.value) {
      if (max >= 99999) {
        return `Enterprise · Unlimited (${used} active)`
      }
      return `Licensed ${used}/${max} · ${licenseDaysRemaining.value} days remaining`
    }
    if (licensePromo.value) {
      return `Promo ${used}/${max} devices`
    }
    return `Free ${used}/${max} devices`
  })

  const licenseBadgeTitle = computed(() => {
    if (licenseActivated.value) {
      if (licenseMaxDevices.value >= 99999) {
        return 'Enterprise Full Source License · Unlimited devices & permanent validity'
      }
      return `License expiration: ${licenseExpiresAt.value || '-'}, click to manage license`
    }
    if (licensePromo.value) {
      return `Promo valid until ${licenseExpiresAt.value}, reverts to ${licensePostPromoMaxDevices.value} devices after expiration`
    }
    return 'Free edition license, click to manage license'
  })

  const licenseBadgeClass = computed(() => {
    if (licenseActivated.value && licenseMaxDevices.value >= 99999) return 'badge-enterprise'
    if (licenseStatus.value === 'expired' || isLicenseExpired.value) return 'badge-danger'
    if (licenseUsagePercent.value >= 100) return 'badge-danger'
    if (licenseUsagePercent.value >= 80) return 'badge-warn'
    if (licenseActivated.value && licenseDaysRemaining.value <= 30) return 'badge-warn'
    return ''
  })


  // Helper: Update online and offline lists based on currently active device list
  // Items in deviceList can carry server status: { id, info, online, firstSeen, lastSeen }
  // Default online (legacy server) treated as online for backward compatibility
  function processDeviceList(deviceList) {
    const activeDevices = deviceList.filter(d => d.online !== false)
    const serverOffline = deviceList.filter(d => d.online === false)
    const activeIds = activeDevices.map(d => d.id)

    // 1. Find newly offline devices (previously online but missing from new active list)
    devices.value.forEach(d => {
      if (!activeIds.includes(d.id)) {
        const serverRec = serverOffline.find(sd => sd.id === d.id)
        const offlineDev = {
          ...d,
          info: serverRec?.info || d.info,
          status: 'offline',
          firstSeen: serverRec?.firstSeen || d.firstSeen,
          lastSeen: serverRec?.lastSeen || d.lastSeen,
          lastOffline: new Date().toISOString()
        }
        const idx = offlineDevices.value.findIndex(od => od.id === d.id)
        if (idx === -1) {
          offlineDevices.value.push(offlineDev)
        } else {
          // Retain or update latest properties
          offlineDevices.value[idx] = { ...offlineDevices.value[idx], ...offlineDev }
        }
      }
    })

    // 1b. Server-recorded offline devices: merge directly into offline list
    serverOffline.forEach(sd => {
      if (devices.value.some(d => d.id === sd.id)) return // Already handled in step 1
      const idx = offlineDevices.value.findIndex(od => od.id === sd.id)
      if (idx > -1) {
        const old = offlineDevices.value[idx]
        offlineDevices.value[idx] = {
          ...old,
          info: sd.info || old.info,
          firstSeen: sd.firstSeen || old.firstSeen,
          lastSeen: sd.lastSeen || old.lastSeen
        }
      } else {
        offlineDevices.value.push({
          id: sd.id,
          info: sd.info || null,
          status: 'offline',
          snapshot: null,
          firstSeen: sd.firstSeen || null,
          lastSeen: sd.lastSeen || null,
          lastOffline: null
        })
      }
    })

    // 2. Filter online list to retain only active devices and update info
    const newOnlineList = devices.value.filter(d => activeIds.includes(d.id)).map(d => {
      const activeDev = activeDevices.find(ad => ad.id === d.id)
      return {
        ...d,
        info: activeDev?.info || d.info,
        firstSeen: activeDev?.firstSeen || d.firstSeen,
        clientCount: activeDev?.clientCount ?? d.clientCount ?? 0,
        clients: activeDev?.clients ?? d.clients ?? []
      }
    })

    // 3. Handle reconnected or newly connected devices
    activeDevices.forEach(devData => {
      const id = devData.id
      const existingOnline = newOnlineList.find(d => d.id === id)
      if (!existingOnline) {
        const existingOfflineIdx = offlineDevices.value.findIndex(d => d.id === id)
        if (existingOfflineIdx > -1) {
          // Remove from offline list and move back to online list
          const resurrected = offlineDevices.value.splice(existingOfflineIdx, 1)[0]
          newOnlineList.push({
            ...resurrected,
            info: devData.info,
            status: 'online',
            firstSeen: devData.firstSeen || resurrected.firstSeen,
            lastSeen: new Date().toISOString(),
            clientCount: devData.clientCount ?? resurrected.clientCount ?? 0,
            clients: devData.clients ?? resurrected.clients ?? []
          })
        } else {
          // Newly online devices
          newOnlineList.push({
            id,
            info: devData.info,
            status: 'online',
            snapshot: null,
            firstSeen: devData.firstSeen || null,
            lastSeen: new Date().toISOString(),
            clientCount: devData.clientCount ?? 0,
            clients: devData.clients ?? []
          })
        }
      }
    })

    newOnlineList.sort((a, b) => a.id.localeCompare(b.id))
    devices.value = newOnlineList
  }

  async function fetchDevices() {
    loading.value = true
    error.value = null
    
    if (import.meta.env.VITE_DEMO_MODE === 'true') {
      try {
        const { MOCK_DEVICES, startMockStatsGenerator } = await import('@/mock/demoEngine')
        const activeList = MOCK_DEVICES.filter(d => d.status === 'online')
        devices.value = activeList.map(d => ({
          ...d,
          info: d.info,
          status: d.status
        }))
        const offlineList = MOCK_DEVICES.filter(d => d.status === 'offline')
        offlineDevices.value = offlineList

        if (!window.__mock_stats_started) {
          window.__mock_stats_started = true
          startMockStatsGenerator((updatedList) => {
            updatedList.forEach(item => {
              const target = devices.value.find(d => d.id === item.id)
              if (target) {
                target.stats = { ...item.stats }
              }
            })
          })
        }
      } catch (e) {
        console.error('Demo devices load error:', e)
      } finally {
        loading.value = false
      }
      return
    }

    try {
      const res = await fetch('/devices')
      const data = await res.json()
      
      if (Array.isArray(data)) {
        const deviceList = data.map(item => {
          if (typeof item === 'string') {
            return { id: item, info: null }
          }
          return {
            id: item.device_id,
            info: item.device_info,
            online: item.online !== false,
            firstSeen: item.first_seen || null,
            lastSeen: item.last_seen || null,
            clientCount: item.client_count || 0,
            clients: item.clients || []
          }
        })
        processDeviceList(deviceList)
      } else {
        processDeviceList([])
      }
    } catch (e) {
      error.value = e.message
      console.error('Failed to fetch devices:', e)
    } finally {
      loading.value = false
    }
  }

  function addDevice(device) {
    const existing = devices.value.find(d => d.id === device.id)
    if (!existing) {
      // Check if in offline list
      const idx = offlineDevices.value.findIndex(d => d.id === device.id)
      if (idx > -1) {
        offlineDevices.value.splice(idx, 1)
      }
      devices.value.push({ ...device, status: 'online', lastSeen: new Date().toISOString() })
      devices.value.sort((a, b) => a.id.localeCompare(b.id))
    }
  }

  function removeDevice(deviceId) {
    const index = devices.value.findIndex(d => d.id === deviceId)
    if (index > -1) {
      devices.value.splice(index, 1)
    }
    const idx = offlineDevices.value.findIndex(d => d.id === deviceId)
    if (idx > -1) {
      offlineDevices.value.splice(idx, 1)
    }
  }

  function updateFromList(idList) {
    if (!Array.isArray(idList)) return
    const deviceList = idList.map(item => {
      if (typeof item === 'string') {
        return { id: item, info: null }
      }
      return {
        id: item.device_id,
        info: item.device_info || null,
        online: item.online !== false,
        firstSeen: item.first_seen || null,
        lastSeen: item.last_seen || null,
        clientCount: item.client_count || 0,
        clients: item.clients || []
      }
    })
    processDeviceList(deviceList)
    debugLog('[Store] Device list updated via broadcast:', idList)
  }

  function updateSnapshot(deviceId, base64Data) {
    const index = devices.value.findIndex(d => d.id === deviceId)
    if (index > -1) {
      // Deep update properties
      devices.value[index].snapshot = `data:image/png;base64,${base64Data}`
      // Trigger reactivity by reassigning array reference
      devices.value = [...devices.value]
      debugLog(`[Store] Snapshot updated for ${deviceId}, length: ${base64Data.length}`)
    }
  }

  const activeDeviceIds = ref([])
  const focusedDeviceId = ref(null)
  const masterDeviceId = ref(null)
  const multiLayoutMode = ref('grid') // 'grid' | 'tabs' | 'master-slave' | 'floating'
  const audioFocusMode = ref('exclusive') // 'exclusive' (exclusive audio) | 'mix' (mixed audio)
  const globalBroadcastInput = ref(false) // Whether keyboard and IME broadcast globally
  const maximizedDeviceId = ref(null) // Single device zoom/focus ID

  const activeWebRTCMap = shallowRef(new Map())

  function registerWebRTC(deviceId, webrtcInstance) {
    if (!deviceId || !webrtcInstance) return
    const newMap = new Map(activeWebRTCMap.value)
    newMap.set(deviceId, markRaw(webrtcInstance))
    activeWebRTCMap.value = newMap
  }

  function unregisterWebRTC(deviceId) {
    if (!deviceId) return
    if (activeWebRTCMap.value.has(deviceId)) {
      const newMap = new Map(activeWebRTCMap.value)
      newMap.delete(deviceId)
      activeWebRTCMap.value = newMap
    }
  }

  function getWebRTC(deviceId) {
    if (!deviceId) return null
    return activeWebRTCMap.value.get(deviceId) || null
  }

  // Backward-compatible single device activeDeviceId
  const activeDeviceId = computed({
    get: () => focusedDeviceId.value || activeDeviceIds.value[0] || null,
    set: (val) => {
      if (!val) {
        closeAllDevices()
      } else {
        openDevice(val)
      }
    }
  })

  // Backward-compatible activeWebRTC: return focused or first device instance
  const activeWebRTC = computed(() => {
    if (focusedDeviceId.value && activeWebRTCMap.value.has(focusedDeviceId.value)) {
      return activeWebRTCMap.value.get(focusedDeviceId.value)
    }
    const firstId = activeDeviceIds.value[0]
    if (firstId && activeWebRTCMap.value.has(firstId)) {
      return activeWebRTCMap.value.get(firstId)
    }
    return null
  })

  const activeDevice = computed(() => 
    devices.value.find(d => d.id === activeDeviceId.value)
  )

  function openDevice(id) {
    if (!id) return
    if (!activeDeviceIds.value.includes(id)) {
      activeDeviceIds.value.push(id)
    }
    focusedDeviceId.value = id
    if (!masterDeviceId.value) {
      masterDeviceId.value = id
    }
  }

  function closeDevice(id) {
    const index = activeDeviceIds.value.indexOf(id)
    if (index > -1) {
      activeDeviceIds.value.splice(index, 1)
    }
    unregisterWebRTC(id)
    if (focusedDeviceId.value === id) {
      focusedDeviceId.value = activeDeviceIds.value[activeDeviceIds.value.length - 1] || null
    }
    if (masterDeviceId.value === id) {
      masterDeviceId.value = activeDeviceIds.value[0] || null
    }
    if (maximizedDeviceId.value === id) {
      maximizedDeviceId.value = null
    }
    deviceConnectionModes.value[id] = 'display'
    if (activeDeviceIds.value.length === 0) {
      closeAllDevices()
    }
  }

  // Per-device session connection mode ('display' | 'camera'), default 'display'
  const deviceConnectionModes = ref({})

  function setDeviceMode(deviceId, mode = 'display') {
    if (!deviceId) return
    deviceConnectionModes.value[deviceId] = mode
  }

  function getDeviceMode(deviceId) {
    if (!deviceId) return 'display'
    return deviceConnectionModes.value[deviceId] || 'display'
  }

  function openDeviceAsCamera(id) {
    if (!id) return
    setDeviceMode(id, 'camera')
    openDevice(id)
  }

  function openDeviceAsWebSocket(id) {
    if (!id) return
    setDeviceMode(id, 'websocket')
    openDevice(id)
  }

  function closeAllDevices() {
    activeDeviceIds.value = []
    focusedDeviceId.value = null
    masterDeviceId.value = null
    maximizedDeviceId.value = null
    activeWebRTCMap.value = new Map()
    deviceConnectionModes.value = {}
  }

  function focusDevice(id) {
    if (activeDeviceIds.value.includes(id)) {
      focusedDeviceId.value = id
    }
  }

  function setMasterDevice(id) {
    if (activeDeviceIds.value.includes(id)) {
      masterDeviceId.value = id
    }
  }

  function setMultiLayoutMode(mode) {
    multiLayoutMode.value = mode
  }

  function toggleMaximizeDevice(id) {
    if (maximizedDeviceId.value === id) {
      maximizedDeviceId.value = null
    } else {
      maximizedDeviceId.value = id
    }
  }

  function setActiveDevice(id) {
    if (id) {
      openDevice(id)
    } else {
      closeAllDevices()
    }
  }

  function setActiveWebRTC(webrtcInstance) {
    if (activeDeviceId.value && webrtcInstance) {
      registerWebRTC(activeDeviceId.value, webrtcInstance)
    } else if (!webrtcInstance && activeDeviceId.value) {
      unregisterWebRTC(activeDeviceId.value)
    }
  }

  function clearActiveDevice() {
    closeAllDevices()
  }

  const deviceHistory = ref({})

  function updateMetrics(deviceId, metrics) {
    const index = devices.value.findIndex(d => d.id === deviceId)
    if (index > -1) {
      devices.value[index].metrics = metrics
      devices.value = [...devices.value]
    }

    if (!deviceHistory.value[deviceId]) {
      deviceHistory.value[deviceId] = {
        cpu: [],
        memory: [],
        disk: [],
        temp: [],
        downSpeed: [],
        upSpeed: [],
        timestamps: []
      }
    }

    const history = deviceHistory.value[deviceId]
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    const ss = String(now.getSeconds()).padStart(2, '0')
    const timeStr = `${hh}:${mm}:${ss}`

    history.cpu.push(metrics.cpu || 0)
    history.memory.push(metrics.memory_percent || 0)
    history.disk.push(metrics.disk_percent || 0)
    history.temp.push(metrics.temperature || 0)
    history.downSpeed.push(metrics.download_speed || 0)
    history.upSpeed.push(metrics.upload_speed || 0)
    history.timestamps.push(timeStr)

    if (history.cpu.length > 360) {
      history.cpu.shift()
      history.memory.shift()
      history.disk.shift()
      history.temp.shift()
      history.downSpeed.shift()
      history.upSpeed.shift()
      history.timestamps.shift()
    }

    // Explicitly trigger reactive update for dashboard charts
    deviceHistory.value = { ...deviceHistory.value }
  }

  const previewCallbacks = new Map() // deviceId -> Map<subscriberId, callback>

  function registerPreviewCallback(deviceId, subscriberOrCb, maybeCallback) {
    let subscriberId = 'default'
    let cb = maybeCallback
    if (typeof subscriberOrCb === 'function') {
      cb = subscriberOrCb
      subscriberId = 'default'
    } else {
      subscriberId = String(subscriberOrCb || 'default')
    }
    if (!cb) return
    if (!previewCallbacks.has(deviceId)) {
      previewCallbacks.set(deviceId, new Map())
    }
    previewCallbacks.get(deviceId).set(subscriberId, cb)
  }

  function unregisterPreviewCallback(deviceId, subscriberId = 'default') {
    const subMap = previewCallbacks.get(deviceId)
    if (subMap) {
      subMap.delete(subscriberId)
      if (subMap.size === 0) {
        previewCallbacks.delete(deviceId)
      }
    }
  }

  function hasPreviewSubscribers(deviceId) {
    const subMap = previewCallbacks.get(deviceId)
    return Boolean(subMap && subMap.size > 0)
  }

  function sendPreviewControl(action, deviceId, fps, maxSize, bitrate, stayAwake) {
    if (globalWs && globalWs.readyState === WebSocket.OPEN) {
      const payload = {
        message_type: action,
        type: action,
        device_id: deviceId
      }
      if (fps !== undefined && fps > 0) payload.fps = fps
      if (maxSize !== undefined && maxSize > 0) payload.max_size = maxSize
      if (bitrate !== undefined && bitrate > 0) {
        payload.bitrate = bitrate >= 10000 ? Math.round(bitrate) : Math.round(bitrate * 1000000)
      }
      if (stayAwake !== undefined) payload.stay_awake = stayAwake
      globalWs.send(JSON.stringify(payload))
    }
  }

  // Throttle group_control_event error logs when WS is not ready
  let lastGroupControlWarnTs = 0

  function sendGroupControlEvent(targetDeviceIds, event) {
    if (globalWs && globalWs.readyState === WebSocket.OPEN) {
      globalWs.send(JSON.stringify({
        message_type: 'group_control_event',
        target_device_ids: targetDeviceIds,
        event: event
      }))
    } else {
      // Diagnostic: provide clear log when preview direct control / group event is dropped (2s throttle)
      const now = Date.now()
      if (now - lastGroupControlWarnTs > 2000) {
        lastGroupControlWarnTs = now
        console.warn(`[Store] group_control_event dropped: globalWs ${globalWs ? 'readyState=' + globalWs.readyState : 'is null'}`, targetDeviceIds, event && event.type)
      }
    }
  }

  function sendInjectData(channel, payload, targetDeviceIds) {
    if (globalWs && globalWs.readyState === WebSocket.OPEN) {
      const msg = {
        message_type: 'inject_data',
        channel: channel,
        payload: payload
      }
      if (Array.isArray(targetDeviceIds) && targetDeviceIds.length > 0) {
        msg.target_device_ids = targetDeviceIds
      }
      globalWs.send(JSON.stringify(msg))
    }
  }

  function handlePreviewBinary(buffer) {
    if (buffer.byteLength < 49) return
    const view = new DataView(buffer)
    
    // Check Magic: PREV
    if (view.getUint8(0) !== 0x50 || view.getUint8(1) !== 0x52 ||
        view.getUint8(2) !== 0x45 || view.getUint8(3) !== 0x56) return

    // Extract DeviceID (32 bytes)
    const idBytes = new Uint8Array(buffer, 4, 32)
    let deviceId = new TextDecoder().decode(idBytes)
    const nullIdx = deviceId.indexOf('\0')
    if (nullIdx !== -1) {
      deviceId = deviceId.substring(0, nullIdx)
    }

    const subMap = previewCallbacks.get(deviceId)
    if (!subMap || subMap.size === 0) return

    const isKey = view.getUint8(36) === 0x01
    // BigEndian read uint64 ptsUs
    const ptsUs = Number(view.getBigUint64(37, false))
    const payloadLen = view.getUint32(45, false)
    const nalu = new Uint8Array(buffer, 49, payloadLen)

    subMap.forEach(cb => {
      try {
        cb(nalu, isKey, ptsUs)
      } catch (err) {
        console.error(`[Preview] Callback error for ${deviceId}:`, err)
      }
    })
  }

  let globalWs = null
  let licensePollTimer = null

  function initSignaling() {
    if (globalWs) return

    fetchLicenseStatus()
    // License status 60s fallback polling (safety net for WS push)
    if (!licensePollTimer) {
      licensePollTimer = setInterval(fetchLicenseStatus, 60000)
    }

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const token = localStorage.getItem('auth_token') || ''
    const url = `${protocol}//${location.host}/connect_client?token=${encodeURIComponent(token)}`
    
    debugLog('[Store] Connecting to global signaling:', url)
    globalWs = new WebSocket(url)
    globalWs.binaryType = 'arraybuffer'

    globalWs.onmessage = (evt) => {
      if (evt.data instanceof ArrayBuffer) {
        handlePreviewBinary(evt.data)
        return
      }
      try {
        const msg = JSON.parse(evt.data)
        if (msg.message_type === 'snapshot_update') {
          updateSnapshot(msg.device_id, msg.data)
        } else if (msg.message_type === 'snapshot_updated') {
          // Update notifications under HTTP mode
          handleSnapshotUpdated(msg.device_id, msg.url)
        } else if (msg.message_type === 'global_settings_updated') {
          localStorage.setItem('cloudphone_settings', JSON.stringify(msg.settings))
          window.dispatchEvent(new CustomEvent('cloudphone-settings-updated', { detail: { deviceId: '' } }))
        } else if (msg.message_type === 'device_list_update') {
          updateFromList(msg.devices)
        } else if (msg.message_type === 'tags_update') {
          const tagsStore = useTagStore()
          tagsStore.updateTagsFromRemote(msg.tags, msg.deviceTags)
        } else if (msg.type === 'device_metrics') {
          updateMetrics(msg.device_id, msg.metrics)
        } else if (msg.message_type === 'task_status_updated') {
          const task = msg.task
          if (currentTask.value && currentTask.value.task_id === task.task_id) {
            currentTask.value = task
            const allDone = Object.values(task.devices).every(sub => ['success', 'failed'].includes(sub.status))
            if (allDone) {
              stopTrackingTask()
            }
          }
        } else if (msg.message_type === 'license_update') {
          // Server broadcast license updates (limit reached, promo expired, etc.)
          applyLicenseState(msg)
        } else if (msg.error === 'license_expired') {
          isLicenseExpired.value = true
          licenseErrorMsg.value = msg.reason || 'Current version is no longer supported, please upgrade'
          globalMachineID.value = msg.machine_id || ''
        }
      } catch (e) {
        console.error('[Store] Message error:', e)
      }
    }

    globalWs.onclose = () => {
      globalWs = null
      setTimeout(initSignaling, 3000) // Auto-reconnect
    }
  }

  // Populate license state (/api/license_status or license_update) into store
  function applyLicenseState(data) {
    isLicenseExpired.value = !!data.license_expired
    licenseErrorMsg.value = data.error_msg || ''
    globalMachineID.value = data.machine_id || ''
    licenseMaxDevices.value = data.max_devices || 50
    licenseExpiresAt.value = data.expires_at || ''
    licenseDaysRemaining.value = data.days_remaining || 0
    licenseStatus.value = data.status || 'valid'
    licenseActivated.value = !!data.activated
    licenseCustomer.value = data.customer || ''
    licenseCurrentDevices.value = data.current_devices || 0
    licensePromo.value = !!data.promo
    licensePostPromoMaxDevices.value = data.post_promo_max_devices || 10
  }

  async function fetchLicenseStatus() {
    try {
      const token = localStorage.getItem('auth_token') || ''
      const res = await fetch('/api/license_status', {
        headers: token ? { 'Authorization': 'Bearer ' + token } : {}
      })
      if (res.ok) {
        const data = await res.json()
        applyLicenseState(data)
      }
    } catch (e) {
      console.error('Failed to fetch license status:', e)
    }
  }

  async function activateLicense(licenseKey) {
    try {
      const res = await fetch('/api/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + (localStorage.getItem('auth_token') || '')
        },
        body: JSON.stringify({ license: licenseKey })
      })
      const data = await res.json()
      if (res.ok && data.status === 'success') {
        isLicenseExpired.value = false
        licenseErrorMsg.value = ''
        // Auto refresh device list and signaling upon success
        await fetchDevices()
        if (!globalWs || globalWs.readyState !== WebSocket.OPEN) {
          initSignaling()
        }
        return { success: true }
      } else {
        return { success: false, error: data.error || 'Activation failed, please verify your license key' }
      }
    } catch (e) {
      return { success: false, error: e.message || 'Network request error' }
    }
  }

  function quitAgent(deviceId) {
    if (!globalWs || globalWs.readyState !== WebSocket.OPEN) {
      console.warn('[Store] Signaling not connected, cannot quit agent')
      return
    }
    globalWs.send(JSON.stringify({
      message_type: 'quit_agent',
      device_id: deviceId
    }))
  }

  // Delete offline device record (admin only; server rejects deleting online devices)
  async function deleteOfflineDevice(deviceId) {
    const token = localStorage.getItem('auth_token') || ''
    const res = await fetch(`/api/devices/${encodeURIComponent(deviceId)}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    })
    if (!res.ok) {
      const text = (await res.text()).trim()
      throw new Error(text || `Delete failed (${res.status})`)
    }
    removeDevice(deviceId)
  }

  function handleSnapshotUpdated(deviceId, url) {
    const index = devices.value.findIndex(d => d.id === deviceId)
    if (index > -1) {
      const token = localStorage.getItem('auth_token') || ''
      // Add timestamp to bust browser cache and attach auth token
      devices.value[index].snapshot = url + '?t=' + Date.now() + '&token=' + encodeURIComponent(token)
      devices.value = [...devices.value]
      debugLog(`[Store] Snapshot URL updated for ${deviceId}`)
    }
  }

  // Global high-frequency preview mode state
  const globalPreviewMode = ref(false)

  // Global preview direct control mode state
  const globalInteractiveMode = ref(false)

  // Global bottom console state
  const showGlobalConsole = ref(false)
  const consoleDeviceId = ref('')
  // Clamp initial height to current viewport to prevent handles overflowing screen,
  // and becoming unreachable on smaller screens
  const globalConsoleHeight = ref(clampConsoleHeight(parseInt(localStorage.getItem('cloudphone_console_height') || '380', 10)))

  // Offline device filter view: show only offline devices
  const showOfflineOnly = ref(false)

  // Recently added filter view (devices first registered within 30 minutes)
  const showRecentOnly = ref(false)
  const RECENT_WINDOW_MS = 30 * 60 * 1000
  // 30-second rolling clock for 'within 30 mins' computed filter
  const nowTick = ref(Date.now())
  setInterval(() => { nowTick.value = Date.now() }, 30000)

  function isRecentDevice(d) {
    if (!d.firstSeen) return false
    const t = new Date(d.firstSeen).getTime()
    if (isNaN(t)) return false
    return (nowTick.value - t) < RECENT_WINDOW_MS
  }

  // Recently added devices (union of online and offline) for counts and filtering
  const recentDevices = computed(() =>
    [...devices.value, ...offlineDevices.value].filter(isRecentDevice)
  )

  function openGlobalConsole(deviceId) {
    if (deviceId) {
      consoleDeviceId.value = deviceId
    } else {
      // fallback
      if (activeDeviceId.value) {
        consoleDeviceId.value = activeDeviceId.value
      } else if (onlineDevices.value.length > 0) {
        consoleDeviceId.value = onlineDevices.value[0].id
      }
    }
    showGlobalConsole.value = true
  }

  function toggleGlobalConsole() {
    if (showGlobalConsole.value) {
      showGlobalConsole.value = false
    } else {
      // Fallback check when enabled
      if (!consoleDeviceId.value) {
        if (activeDeviceId.value) {
          consoleDeviceId.value = activeDeviceId.value
        } else if (onlineDevices.value.length > 0) {
          consoleDeviceId.value = onlineDevices.value[0].id
        }
      }
      showGlobalConsole.value = true
    }
  }

  function closeGlobalConsole() {
    showGlobalConsole.value = false
  }

  function destroyGlobalConsole() {
    showGlobalConsole.value = false
    consoleDeviceId.value = null
  }

  // Clamp terminal height: upper limit follows viewport (preserve at least 100px on top)
  function clampConsoleHeight(height) {
    const maxHeight = typeof window !== 'undefined' ? Math.max(300, window.innerHeight - 100) : 1200
    return Math.max(200, Math.min(maxHeight, height))
  }

  function setConsoleHeight(height) {
    const validHeight = clampConsoleHeight(height)
    globalConsoleHeight.value = validHeight
    try {
      localStorage.setItem('cloudphone_console_height', String(validHeight))
    } catch(e) {}
  }

  // Re-clamp on window resize to prevent terminal exceeding screen height.
  // Do not write back to localStorage: preserve user preference for larger displays.
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', () => {
      const clamped = clampConsoleHeight(globalConsoleHeight.value)
      if (clamped !== globalConsoleHeight.value) {
        globalConsoleHeight.value = clamped
      }
    })
  }

  const currentTask = ref(null)
  let trackingTimer = null

  function startTrackingTask(taskId) {
    stopTrackingTask()
    pollTaskDetails(taskId)
    trackingTimer = setInterval(() => pollTaskDetails(taskId), 2000)
  }

  function stopTrackingTask() {
    if (trackingTimer) {
      clearInterval(trackingTimer)
      trackingTimer = null
    }
  }

  async function pollTaskDetails(taskId) {
    const token = localStorage.getItem('auth_token') || ''
    try {
      const res = await fetch(`/api/tasks/details?task_id=${encodeURIComponent(taskId)}`, {
        headers: { 'Authorization': 'Bearer ' + token }
      })
      if (res.ok) {
        const data = await res.json()
        currentTask.value = data
        
        const allDone = Object.values(data.devices).every(sub => ['success', 'failed'].includes(sub.status))
        if (allDone) {
          stopTrackingTask()
        }
      }
    } catch (e) {
      console.warn('Failed to poll task details:', e)
    }
  }

  return {
    currentTask,
    startTrackingTask,
    stopTrackingTask,
    devices,
    offlineDevices,
    loading,
    error,
    activeDeviceId,
    activeDeviceIds,
    focusedDeviceId,
    masterDeviceId,
    multiLayoutMode,
    audioFocusMode,
    globalBroadcastInput,
    maximizedDeviceId,
    openDevice,
    closeDevice,
    closeAllDevices,
    focusDevice,
    setMasterDevice,
    setMultiLayoutMode,
    toggleMaximizeDevice,
    activeWebRTC,
    activeWebRTCMap,
    registerWebRTC,
    unregisterWebRTC,
    getWebRTC,
    activeDevice,
    onlineDevices,
    deviceHistory,
    showGlobalConsole,
    consoleDeviceId,
    globalConsoleHeight,
    showOfflineOnly,
    showRecentOnly,
    recentDevices,
    fetchDevices,
    addDevice,
    removeDevice,
    updateFromList,
    updateSnapshot,
    updateMetrics,
    initSignaling, // Export
    quitAgent,
    deleteOfflineDevice,
    setActiveDevice,
    openDeviceAsCamera,
    openDeviceAsWebSocket,
    setDeviceMode,
    getDeviceMode,
    setActiveWebRTC,
    clearActiveDevice,
    openGlobalConsole,
    toggleGlobalConsole,
    closeGlobalConsole,
    destroyGlobalConsole,
    setConsoleHeight,
    isLicenseExpired,
    licenseErrorMsg,
    globalMachineID,
    licenseMaxDevices,
    licenseExpiresAt,
    licenseDaysRemaining,
    licenseStatus,
    licenseActivated,
    licenseCustomer,
    licenseCurrentDevices,
    licensePromo,
    licensePostPromoMaxDevices,
    applyLicenseState,
    fetchLicenseStatus,
    activateLicense,
    registerPreviewCallback,
    unregisterPreviewCallback,
    hasPreviewSubscribers,
    sendPreviewControl,
    sendGroupControlEvent,
    sendInjectData,
    globalPreviewMode,
    globalInteractiveMode,
    searchQuery,
    cardSize,
    viewMode,
    showLicenseModal,
    showGlobalSettingsModal,
    showTagManagerModal,
    setCardSize,
    setViewMode,
    toggleViewMode,
    licenseUsedCount,
    licenseUsagePercent,
    licenseBadgeText,
    licenseBadgeTitle,
    licenseBadgeClass
  }
})
