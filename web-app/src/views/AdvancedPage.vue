<template>
  <div class="advanced-container" id="advanced-page-root">
    <!-- Left: Device selection & group control -->
    <div class="sidebar-panel">
      <div class="panel-header">
        <h3>Peripheral Control Center</h3>
        <span class="sub-text">Select devices for peripheral and GPS injection</span>
      </div>
      
      <!-- Master device selection -->
      <div class="section-title">Select Target Device</div>
      <div class="device-list-container">
        <div v-if="onlineDevices.length === 0" class="no-devices">
          No online custom cloud phones available
        </div>
        <div 
          v-for="dev in onlineDevices" 
          :key="dev.id"
          class="device-item"
          :class="{ active: selectedDeviceId === dev.id }"
          @click="selectDevice(dev.id)"
        >
          <div class="device-avatar">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
              <line x1="12" y1="18" x2="12.01" y2="18"></line>
            </svg>
          </div>
          <div class="device-info">
            <span class="device-name">{{ dev.name || dev.id }}</span>
            <span class="device-status">
              <span class="status-indicator online"></span>
              {{ dev.ip || 'Online' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Group control broadcast status -->
      <div class="batch-control-status">
        <div class="status-title">Group Control Mode (Multi-Broadcast)</div>
        <div class="batch-sw-row">
          <label class="switch-label">
            <input type="checkbox" v-model="batchEnabled" />
            <span class="switch-slider"></span>
          </label>
          <span class="batch-lbl-text">{{ batchEnabled ? 'Batch broadcast enabled' : 'Send only to selected device' }}</span>
        </div>
        <div v-if="batchEnabled" class="batch-checklist">
          <div 
            v-for="dev in onlineDevices" 
            :key="dev.id" 
            class="batch-check-item"
            @click="toggleBatchDevice(dev.id)"
          >
            <input type="checkbox" :checked="batchDeviceIds.includes(dev.id)" readonly />
            <span class="batch-dev-name">{{ dev.name || dev.id }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Center control main panel -->
    <div class="main-control-panel">
      <!-- Tabs header -->
      <div class="tabs-header">
        <button 
          class="tab-btn" 
          :class="{ active: activeTab === 'gps' }"
          @click="activeTab = 'gps'"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          GPS Simulation
        </button>
        <button 
          class="tab-btn" 
          :class="{ active: activeTab === 'sensor' }"
          @click="activeTab = 'sensor'"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
          </svg>
          Sensor Simulation
        </button>
      </div>

      <!-- Tab content -->
      <div class="tab-content">
        <!-- GPS Simulation -->
        <div v-show="activeTab === 'gps'" class="gps-tab-container">
          <div class="map-and-controls">
            <!-- Leaflet map or radar grid fallback -->
            <div class="map-wrapper">
              <div id="leaflet-map" class="map-element"></div>
              <div v-if="mapLoadError" class="map-fallback">
                <div class="radar-circle">
                  <div class="radar-line"></div>
                </div>
                <div class="fallback-tips">
                  <p>Online map dependency not detected (CDN failed)</p>
                  <p>Fallen back to radar grid. You can enter coordinates manually.</p>
                </div>
              </div>
            </div>

            <!-- Control Card -->
            <div class="gps-controls-card">
              <div class="section-title">Coordinate Control</div>
              <div class="form-grid">
                <div class="form-group">
                  <label>Latitude (Lat)</label>
                  <input type="number" v-model.number="gpsData.lat" step="0.0001" @input="updateMarker" />
                </div>
                <div class="form-group">
                  <label>Longitude (Lon)</label>
                  <input type="number" v-model.number="gpsData.lon" step="0.0001" @input="updateMarker" />
                </div>
                <div class="form-group">
                  <label>Altitude (Alt / m)</label>
                  <input type="number" v-model.number="gpsData.alt" step="1" />
                </div>
                <div class="form-group">
                  <label>Speed (Spd / m/s)</label>
                  <input type="number" v-model.number="gpsData.spd" step="0.1" />
                </div>
              </div>
              
              <div class="btn-group">
                <button class="primary-btn" @click="sendSingleGps" :disabled="!hasTargets">Teleport</button>
              </div>

              <div class="divider"></div>

              <div class="section-title">Route Simulation</div>
              <div class="path-settings">
                <div class="mode-select">
                  <button 
                    v-for="mode in travelModes" 
                    :key="mode.value"
                    class="mode-btn"
                    :class="{ active: travelMode === mode.value }"
                    @click="travelMode = mode.value"
                  >
                    {{ mode.label }} ({{ mode.speed }}km/h)
                  </button>
                </div>

                <div class="dest-info" v-if="destination">
                  <span class="dest-lbl">Destination: </span>
                  <span class="dest-val">{{ destination.lat.toFixed(4) }}, {{ destination.lon.toFixed(4) }}</span>
                </div>
                <div class="dest-info" v-else>
                  <span class="dest-lbl-hint">Tip: Double-click or right-click map to set destination.</span>
                </div>

                <div class="btn-group" style="margin-top: 15px;">
                  <button 
                    v-if="!simulating" 
                    class="accent-btn" 
                    @click="startSimulation" 
                    :disabled="!hasTargets || !destination"
                  >Start Simulation</button>
                  <button v-else class="danger-btn" @click="stopSimulation">Stop Simulation</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Sensor Simulation -->
        <div v-show="activeTab === 'sensor'" class="sensor-tab-container">
          <div class="sensor-cols">
            <!-- 3D Orientation & Sensors -->
            <div class="sensor-3d-panel">
              <div class="section-title">3D Gravity / Gyroscope Orientation</div>
              <div class="phone-3d-container">
                <div class="phone-3d-card" :style="phone3DStyle">
                  <div class="phone-3d-screen">
                    <div class="phone-camera-hole"></div>
                    <div class="phone-inner-logo">CUSTOM HAL</div>
                    <div class="phone-stat-display">
                      <div>X: {{ sensorData.accel.x.toFixed(1) }}</div>
                      <div>Y: {{ sensorData.accel.y.toFixed(1) }}</div>
                      <div>Z: {{ sensorData.accel.z.toFixed(1) }}</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="preset-actions-row">
                <button class="preset-btn" @click="triggerShake" :disabled="!hasTargets">Shake Device</button>
                <button class="preset-btn" :class="{ active: drivingBumpActive }" @click="toggleDrivingBump" :disabled="!hasTargets">
                  Road Bumps {{ drivingBumpActive ? 'ON' : 'OFF' }}
                </button>
                <button class="preset-btn" @click="triggerFlip" :disabled="!hasTargets">360° Flip</button>
              </div>
            </div>

            <!-- Sensor Parameters -->
            <div class="sensor-sliders-panel">
              <div class="slider-group-box">
                <div class="box-title">Accelerometer (Accel / m/s²)</div>
                <div class="slider-row">
                  <label>X Axis</label>
                  <input type="range" min="-20" max="20" step="0.1" v-model.number="sensorData.accel.x" @input="sendAccel" :disabled="!hasTargets" />
                  <span class="val-display">{{ sensorData.accel.x.toFixed(1) }}</span>
                </div>
                <div class="slider-row">
                  <label>Y Axis</label>
                  <input type="range" min="-20" max="20" step="0.1" v-model.number="sensorData.accel.y" @input="sendAccel" :disabled="!hasTargets" />
                  <span class="val-display">{{ sensorData.accel.y.toFixed(1) }}</span>
                </div>
                <div class="slider-row">
                  <label>Z Axis</label>
                  <input type="range" min="-20" max="20" step="0.1" v-model.number="sensorData.accel.z" @input="sendAccel" :disabled="!hasTargets" />
                  <span class="val-display">{{ sensorData.accel.z.toFixed(1) }}</span>
                </div>
              </div>

              <div class="slider-group-box">
                <div class="box-title">Gyroscope (Gyro / rad/s)</div>
                <div class="slider-row">
                  <label>X Axis</label>
                  <input type="range" min="-10" max="10" step="0.1" v-model.number="sensorData.gyro.x" @input="sendGyro" :disabled="!hasTargets" />
                  <span class="val-display">{{ sensorData.gyro.x.toFixed(1) }}</span>
                </div>
                <div class="slider-row">
                  <label>Y Axis</label>
                  <input type="range" min="-10" max="10" step="0.1" v-model.number="sensorData.gyro.y" @input="sendGyro" :disabled="!hasTargets" />
                  <span class="val-display">{{ sensorData.gyro.y.toFixed(1) }}</span>
                </div>
                <div class="slider-row">
                  <label>Z Axis</label>
                  <input type="range" min="-10" max="10" step="0.1" v-model.number="sensorData.gyro.z" @input="sendGyro" :disabled="!hasTargets" />
                  <span class="val-display">{{ sensorData.gyro.z.toFixed(1) }}</span>
                </div>
              </div>

              <div class="slider-group-box">
                <div class="box-title">Environmental Sensors</div>
                <div class="slider-row">
                  <label>Hinge Angle</label>
                  <input type="range" min="0" max="180" step="1" v-model.number="sensorData.hinge_angle" @input="sendSingleSensor('hinge_angle')" :disabled="!hasTargets" />
                  <span class="val-display">{{ sensorData.hinge_angle }}°</span>
                </div>
                <div class="slider-row">
                  <label>Ambient Light</label>
                  <input type="range" min="0" max="10000" step="10" v-model.number="sensorData.light" @input="sendSingleSensor('light')" :disabled="!hasTargets" />
                  <span class="val-display">{{ sensorData.light }} lx</span>
                </div>
                <div class="slider-row">
                  <label>Ambient Temp</label>
                  <input type="range" min="-20" max="50" step="1" v-model.number="sensorData.temp" @input="sendSingleSensor('temp')" :disabled="!hasTargets" />
                  <span class="val-display">{{ sensorData.temp }} ℃</span>
                </div>
                <div class="slider-row">
                  <label>Proximity</label>
                  <input type="range" min="0" max="5" step="1" v-model.number="sensorData.proximity" @input="sendSingleSensor('proximity')" :disabled="!hasTargets" />
                  <span class="val-display">{{ sensorData.proximity }} cm</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useDeviceStore } from '@/stores/devices'

const deviceStore = useDeviceStore()

const onlineDevices = computed(() => {
  return deviceStore.devices.filter(d => d.status === 'online' || d.status === 'registered')
})

const selectedDeviceId = ref('')
const activeTab = ref('gps')

// Group control config
const batchEnabled = ref(false)
const batchDeviceIds = ref([])

function toggleBatchDevice(id) {
  const idx = batchDeviceIds.value.indexOf(id)
  if (idx > -1) {
    batchDeviceIds.value.splice(idx, 1)
  } else {
    batchDeviceIds.value.push(id)
  }
}

// Watch online devices to keep target list valid
watch(onlineDevices, (newDevs) => {
  batchDeviceIds.value = batchDeviceIds.value.filter(id => newDevs.some(d => d.id === id))
}, { deep: true })

// Check if target devices exist
const hasTargets = computed(() => {
  if (batchEnabled.value) {
    return batchDeviceIds.value.length > 0
  }
  return !!selectedDeviceId.value
})

function selectDevice(id) {
  selectedDeviceId.value = id
}

// GPS data and map
const gpsData = ref({
  lat: 39.9042,
  lon: 116.4074,
  alt: 50.0,
  spd: 0.0
})
const mapLoadError = ref(false)
let leafletMap = null
let currentMarker = null
let destinationMarker = null
let travelPathPolyline = null
let L = null

const travelModes = [
  { label: 'Walking', value: 'walk', speed: 5 },
  { label: 'Running', value: 'run', speed: 12 },
  { label: 'Driving', value: 'drive', speed: 60 }
]
const travelMode = ref('drive')
const destination = ref(null)
const simulating = ref(false)
let simTimer = null

// Async load Leaflet Map
function loadLeaflet() {
  return new Promise((resolve, reject) => {
    if (window.L) {
      resolve(window.L)
      return
    }
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => resolve(window.L)
    script.onerror = () => reject(new Error('Leaflet load failed'))
    document.head.appendChild(script)
  })
}

function initMap() {
  loadLeaflet()
    .then((leaflet) => {
      L = leaflet
      leafletMap = L.map('leaflet-map', {
        zoomControl: true,
        doubleClickZoom: false
      }).setView([gpsData.value.lat, gpsData.value.lon], 13)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
      }).addTo(leafletMap)

      // Main marker
      currentMarker = L.marker([gpsData.value.lat, gpsData.value.lon], {
        draggable: true
      }).addTo(leafletMap)

      currentMarker.on('dragend', () => {
        const pos = currentMarker.getLatLng()
        gpsData.value.lat = pos.lat
        gpsData.value.lon = pos.lng
        sendSingleGps()
      })

      // Double click map to set destination
      leafletMap.on('dblclick', (e) => {
        setDestination(e.latlng.lat, e.latlng.lng)
      })

      leafletMap.on('contextmenu', (e) => {
        setDestination(e.latlng.lat, e.latlng.lng)
      })
    })
    .catch((err) => {
      console.warn('Map CDN failed, falling back to radar view', err)
      mapLoadError.value = true
    })
}

function setDestination(lat, lon) {
  if (!L || !leafletMap) return
  if (destinationMarker) {
    leafletMap.removeLayer(destinationMarker)
  }
  destination.value = { lat, lon }
  destinationMarker = L.marker([lat, lon], {
    icon: L.divIcon({
      className: 'dest-marker',
      html: '<div style="background-color: var(--accent); width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 8px var(--accent);"></div>',
      iconSize: [12, 12]
    })
  }).addTo(leafletMap)

  updatePathDrawing()
}

function updatePathDrawing() {
  if (!L || !leafletMap || !destination.value) return
  if (travelPathPolyline) {
    leafletMap.removeLayer(travelPathPolyline)
  }
  travelPathPolyline = L.polyline([
    [gpsData.value.lat, gpsData.value.lon],
    [destination.value.lat, destination.value.lon]
  ], {
    color: '#3b82f6',
    weight: 3,
    dashArray: '5, 8'
  }).addTo(leafletMap)
}

function updateMarker() {
  if (currentMarker) {
    currentMarker.setLatLng([gpsData.value.lat, gpsData.value.lon])
  }
  if (leafletMap) {
    leafletMap.panTo([gpsData.value.lat, gpsData.value.lon])
  }
  updatePathDrawing()
}

// Simulated movement interpolation algorithm
function startSimulation() {
  if (!destination.value || simulating.value) return
  simulating.value = true

  const targetSpeedKmh = travelModes.find(m => m.value === travelMode.value).speed
  const speedMps = targetSpeedKmh / 3.6 // Convert to m/s
  gpsData.value.spd = speedMps

  // Approximate distance calculation
  // Earth radius approx 6,371,000 m
  const R = 6371000
  
  simTimer = setInterval(() => {
    const lat1 = gpsData.value.lat * Math.PI / 180
    const lon1 = gpsData.value.lon * Math.PI / 180
    const lat2 = destination.value.lat * Math.PI / 180
    const lon2 = destination.value.lon * Math.PI / 180

    // Calculate bearing
    const y = Math.sin(lon2 - lon1) * Math.cos(lat2)
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1)
    let bearing = Math.atan2(y, x) * 180 / Math.PI
    bearing = (bearing + 360) % 360

    // Calculate current distance
    const dLat = lat2 - lat1
    const dLon = lon2 - lon1
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    const dist = R * c

    if (dist <= speedMps) {
      // Reached destination
      gpsData.value.lat = destination.value.lat
      gpsData.value.lon = destination.value.lon
      gpsData.value.spd = 0.0
      sendSingleGps()
      stopSimulation()
      alert('Destination reached!')
      return
    }

    // Step proportionally
    const ratio = speedMps / dist
    const nextLat = gpsData.value.lat + (destination.value.lat - gpsData.value.lat) * ratio
    const nextLon = gpsData.value.lon + (destination.value.lon - gpsData.value.lon) * ratio

    gpsData.value.lat = nextLat
    gpsData.value.lon = nextLon
    
    updateMarker()
    sendSingleGps(bearing)
  }, 1000)
}

function stopSimulation() {
  if (simTimer) {
    clearInterval(simTimer)
    simTimer = null
  }
  simulating.value = false
  gpsData.value.spd = 0.0
}

// Unified data transmission via Pinia globalWs
function injectData(channel, payload) {
  const tIds = batchEnabled.value ? batchDeviceIds.value : [selectedDeviceId.value]
  if (tIds.length === 0 && selectedDeviceId.value) {
    tIds.push(selectedDeviceId.value)
  }

  // Send only if target devices are selected
  if (tIds.length > 0 && tIds[0]) {
    deviceStore.sendInjectData(channel, payload, tIds)
  }
}

// Send GPS
function sendSingleGps(bearing = 0.0) {
  injectData('gps', {
    lat: gpsData.value.lat,
    lon: gpsData.value.lon,
    alt: gpsData.value.alt,
    bea: bearing,
    spd: gpsData.value.spd
  })
}

// Sensor data
const sensorData = ref({
  accel: { x: 0.0, y: 9.8, z: 0.0 },
  gyro: { x: 0.0, y: 0.0, z: 0.0 },
  hinge_angle: 180,
  light: 120,
  temp: 24,
  proximity: 5
})

const phone3DStyle = computed(() => {
  // Tilt 3D phone model using accel
  const rx = sensorData.value.accel.y * 3
  const ry = sensorData.value.accel.x * -3
  const rz = sensorData.value.gyro.z * 15
  return {
    transform: `rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`
  }
})

// Send Accelerometer
function sendAccel() {
  injectData('sensor', {
    type: 'accel',
    x: sensorData.value.accel.x,
    y: sensorData.value.accel.y,
    z: sensorData.value.accel.z
  })
}

// Send Gyroscope
function sendGyro() {
  injectData('sensor', {
    type: 'gyro',
    x: sensorData.value.gyro.x,
    y: sensorData.value.gyro.y,
    z: sensorData.value.gyro.z
  })
}

// Send single-value Sensor
function sendSingleSensor(type) {
  const val = sensorData.value[type]
  injectData('sensor', {
    type: type,
    value: val
  })
}

// Simulate shake gesture
let shakeTimer = null
function triggerShake() {
  if (shakeTimer) return
  let duration = 2000
  let interval = 60
  let count = duration / interval

  shakeTimer = setInterval(() => {
    const rx = (Math.random() - 0.5) * 35
    const ry = (Math.random() - 0.5) * 35
    const rz = (Math.random() - 0.5) * 35

    injectData('sensor', { type: 'accel', x: rx, y: ry, z: rz })
    sensorData.value.accel = { x: rx, y: ry, z: rz }

    count--
    if (count <= 0) {
      clearInterval(shakeTimer)
      shakeTimer = null
      sensorData.value.accel = { x: 0.0, y: 9.8, z: 0.0 }
      sendAccel()
    }
  }, interval)
}

// Simulate phone flip
function triggerFlip() {
  let angle = 0
  const timer = setInterval(() => {
    angle += 15
    sensorData.value.gyro.z = 2.0 // Rotational angular velocity
    sensorData.value.accel.x = Math.sin(angle * Math.PI / 180) * 9.8
    sensorData.value.accel.y = Math.cos(angle * Math.PI / 180) * 9.8
    sendAccel()
    sendGyro()
    if (angle >= 360) {
      clearInterval(timer)
      sensorData.value.gyro.z = 0.0
      sensorData.value.accel = { x: 0.0, y: 9.8, z: 0.0 }
      sendAccel()
      sendGyro()
    }
  }, 50)
}

// Simulate bumpy road noise
const drivingBumpActive = ref(false)
let bumpTimer = null
function toggleDrivingBump() {
  drivingBumpActive.value = !drivingBumpActive.value
  if (drivingBumpActive.value) {
    bumpTimer = setInterval(() => {
      // Add micro-noise
      const nx = (Math.random() - 0.5) * 1.5
      const ny = 9.8 + (Math.random() - 0.5) * 1.5
      const nz = (Math.random() - 0.5) * 1.5
      injectData('sensor', { type: 'accel', x: nx, y: ny, z: nz })
    }, 100)
  } else {
    if (bumpTimer) {
      clearInterval(bumpTimer)
      bumpTimer = null
    }
    sensorData.value.accel = { x: 0.0, y: 9.8, z: 0.0 }
    sendAccel()
  }
}

onMounted(() => {
  // Default select first online device
  if (onlineDevices.value.length > 0) {
    selectDevice(onlineDevices.value[0].id)
  }
  nextTick(() => {
    initMap()
  })
})

onUnmounted(() => {
  stopSimulation()
  if (bumpTimer) clearInterval(bumpTimer)
})
</script>

<style scoped>
.advanced-container {
  display: flex;
  height: 100%;
  background-color: #0f0f13;
  color: #e2e8f0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  overflow: hidden;
}

.sidebar-panel {
  width: 300px;
  border-right: 1px solid #272733;
  background-color: #15151f;
  display: flex;
  flex-direction: column;
  padding: 20px;
}

.panel-header {
  margin-bottom: 20px;
}

.panel-header h3 {
  margin: 0;
  font-size: 18px;
  color: white;
  font-weight: 600;
}

.sub-text {
  font-size: 12px;
  color: #718096;
  margin-top: 4px;
  display: block;
}

.device-list-container {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 20px;
}

.no-devices {
  text-align: center;
  color: #4a5568;
  padding: 40px 10px;
  font-size: 14px;
}

.device-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background-color: #1e1e2d;
  border: 1px solid #2d2d3f;
  border-radius: 8px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.device-item:hover {
  background-color: #27273a;
  border-color: #3b82f6;
}

.device-item.active {
  background-color: rgba(59, 130, 246, 0.15);
  border-color: #3b82f6;
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.2);
}

.device-avatar {
  margin-right: 12px;
  color: #a0aec0;
}

.device-item.active .device-avatar {
  color: #3b82f6;
}

.device-info {
  display: flex;
  flex-direction: column;
}

.device-name {
  font-size: 14px;
  font-weight: 500;
  color: #edf2f7;
}

.device-status {
  font-size: 11px;
  color: #718096;
  display: flex;
  align-items: center;
  margin-top: 3px;
}

.status-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-right: 6px;
}

.status-indicator.online {
  background-color: #10b981;
  box-shadow: 0 0 6px #10b981;
}

.batch-control-status {
  margin-top: auto;
  border-top: 1px solid #272733;
  padding-top: 20px;
}

.status-title {
  font-size: 13px;
  color: #edf2f7;
  font-weight: 600;
  margin-bottom: 10px;
}

.batch-sw-row {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.switch-label {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
  margin-right: 10px;
}

.switch-label input {
  opacity: 0;
  width: 0;
  height: 0;
}

.switch-slider {
  position: absolute;
  cursor: pointer;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: #2d2d3f;
  transition: .4s;
  border-radius: 20px;
}

.switch-slider:before {
  position: absolute;
  content: "";
  height: 14px; width: 14px;
  left: 3px; bottom: 3px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}

input:checked + .switch-slider {
  background-color: #3b82f6;
}

input:checked + .switch-slider:before {
  transform: translateX(16px);
}

.batch-lbl-text {
  font-size: 12px;
  color: #a0aec0;
}

.batch-checklist {
  max-height: 150px;
  overflow-y: auto;
  background-color: #1e1e2d;
  border: 1px solid #2d2d3f;
  border-radius: 6px;
  padding: 8px;
}

.batch-check-item {
  display: flex;
  align-items: center;
  padding: 6px;
  font-size: 12px;
  cursor: pointer;
}

.batch-check-item input {
  margin-right: 8px;
}

.batch-dev-name {
  color: #cbd5e0;
}

/* Main control center */
.main-control-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: #101017;
}

.tabs-header {
  display: flex;
  border-bottom: 1px solid #272733;
  background-color: #151520;
}

.tab-btn {
  padding: 15px 25px;
  background: none;
  border: none;
  color: #718096;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 2px solid transparent;
  transition: all 0.2s ease;
}

.tab-btn:hover {
  color: #edf2f7;
}

.tab-btn.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
}

.tab-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

/* GPS simulation */
.gps-tab-container {
  height: 100%;
}

.map-and-controls {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 20px;
}

.map-wrapper {
  flex: 1;
  min-height: 350px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #272733;
  position: relative;
}

.map-element {
  width: 100%;
  height: 100%;
  z-index: 1;
}

.map-fallback {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background-color: #0c0d12;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 10;
}

.radar-circle {
  width: 120px;
  height: 120px;
  border: 2px solid rgba(59, 130, 246, 0.3);
  border-radius: 50%;
  position: relative;
  margin-bottom: 20px;
}

.radar-line {
  width: 50%;
  height: 2px;
  background: linear-gradient(to right, rgba(59,130,246,0.8), transparent);
  position: absolute;
  top: 50%; left: 50%;
  transform-origin: left center;
  animation: radar-sweep 4s linear infinite;
}

@keyframes radar-sweep {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.fallback-tips {
  text-align: center;
}

.fallback-tips p:first-child {
  font-size: 14px;
  color: #e2e8f0;
  margin: 0 0 6px 0;
}

.fallback-tips p:last-child {
  font-size: 12px;
  color: #718096;
  margin: 0;
}

.gps-controls-card {
  background-color: #151520;
  border: 1px solid #272733;
  border-radius: 12px;
  padding: 20px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: white;
  margin-bottom: 15px;
  border-left: 3px solid #3b82f6;
  padding-left: 8px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 15px;
  margin-bottom: 15px;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  font-size: 11px;
  color: #a0aec0;
  margin-bottom: 5px;
}

.form-group input {
  background-color: #20202e;
  border: 1px solid #2d2d3f;
  border-radius: 6px;
  padding: 8px 12px;
  color: white;
  outline: none;
  transition: border-color 0.2s;
}

.form-group input:focus {
  border-color: #3b82f6;
}

.form-group input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-group {
  display: flex;
  gap: 10px;
}

.primary-btn, .accent-btn, .danger-btn, .preset-btn {
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.primary-btn {
  background-color: #3b82f6;
  color: white;
}

.primary-btn:hover:not(:disabled) {
  background-color: #2563eb;
}

.accent-btn {
  background-color: #10b981;
  color: white;
}

.accent-btn:hover:not(:disabled) {
  background-color: #059669;
}

.danger-btn {
  background-color: #ef4444;
  color: white;
}

.danger-btn:hover {
  background-color: #dc2626;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.divider {
  height: 1px;
  background-color: #272733;
  margin: 20px 0;
}

.path-settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mode-select {
  display: flex;
  gap: 8px;
}

.mode-btn {
  flex: 1;
  background-color: #20202e;
  border: 1px solid #2d2d3f;
  color: #a0aec0;
  padding: 8px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.mode-btn.active {
  background-color: rgba(59, 130, 246, 0.15);
  border-color: #3b82f6;
  color: #3b82f6;
}

.dest-info {
  font-size: 12px;
  background-color: rgba(255,255,255,0.02);
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px dashed #2d2d3f;
}

.dest-lbl {
  color: #718096;
}

.dest-val {
  color: #3b82f6;
  font-family: monospace;
}

.dest-lbl-hint {
  color: #718096;
}

/* Sensor simulation */
.sensor-cols {
  display: flex;
  gap: 24px;
  flex-direction: column;
}

@media(min-width: 900px) {
  .sensor-cols {
    flex-direction: row;
  }
}

.sensor-3d-panel {
  flex: 1;
  background-color: #151520;
  border: 1px solid #272733;
  border-radius: 12px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.phone-3d-container {
  perspective: 1000px;
  width: 170px;
  height: 300px;
  margin: 30px 0;
}

.phone-3d-card {
  width: 100%;
  height: 100%;
  background-color: #2a2b36;
  border-radius: 18px;
  border: 3px solid #474a5e;
  box-shadow: 0 15px 35px rgba(0,0,0,0.6);
  transform-style: preserve-3d;
  transition: transform 0.1s ease-out;
  position: relative;
}

.phone-3d-screen {
  position: absolute;
  top: 8px; left: 8px; right: 8px; bottom: 8px;
  background-color: #0b0c10;
  border-radius: 12px;
  border: 1px solid #1f2833;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: #66fcf1;
  font-family: monospace;
  overflow: hidden;
  text-shadow: 0 0 4px rgba(102,252,241,0.5);
}

.phone-camera-hole {
  width: 8px;
  height: 8px;
  background-color: #222;
  border-radius: 50%;
  position: absolute;
  top: 8px;
}

.phone-inner-logo {
  font-size: 11px;
  color: #4a5568;
  position: absolute;
  bottom: 12px;
}

.phone-stat-display {
  font-size: 13px;
  line-height: 1.6;
}

.preset-actions-row {
  display: flex;
  gap: 8px;
  width: 100%;
}

.preset-btn {
  flex: 1;
  background-color: #20202e;
  border: 1px solid #2d2d3f;
  color: #edf2f7;
}

.preset-btn:hover:not(:disabled) {
  background-color: #2b2b3d;
}

.preset-btn.active {
  background-color: rgba(16, 185, 129, 0.15);
  border-color: #10b981;
  color: #10b981;
}

.sensor-sliders-panel {
  flex: 1.5;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.slider-group-box {
  background-color: #151520;
  border: 1px solid #272733;
  border-radius: 12px;
  padding: 16px;
}

.box-title {
  font-size: 13px;
  font-weight: 600;
  color: #edf2f7;
  margin-bottom: 12px;
}

.slider-row {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
}

.slider-row label {
  width: 80px;
  color: #a0aec0;
}

.slider-row input[type="range"] {
  flex: 1;
  background: #20202e;
  border-radius: 6px;
  outline: none;
  height: 5px;
  accent-color: #3b82f6;
}

.slider-row input[type="range"]:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.val-display {
  width: 70px;
  text-align: right;
  font-family: monospace;
  color: #66fcf1;
}

/* Mobile responsive layout */
@media (max-width: 1024px) {
  .advanced-container {
    flex-direction: column;
    overflow-y: auto;
  }

  /* Left panel top banner on mobile */
  .sidebar-panel {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid #272733;
    padding: 14px;
    flex-shrink: 0;
    box-sizing: border-box;
  }

  .panel-header {
    margin-bottom: 12px;
  }

  .device-list-container {
    flex: none;
    max-height: 180px;
    margin-bottom: 12px;
  }

  .device-item {
    padding: 8px 10px;
    margin-bottom: 6px;
  }

  .batch-control-status {
    margin-top: 0;
    padding-top: 12px;
  }

  .batch-checklist {
    max-height: 120px;
  }

  /* Horizontally scrollable tabs header */
  .tabs-header {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .tab-btn {
    padding: 12px 16px;
    font-size: 13px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .tab-content {
    padding: 14px;
  }

  /* Stack GPS sections on mobile */
  .map-and-controls {
    gap: 14px;
  }

  .map-wrapper {
    flex: none;
    min-height: 260px;
    height: 40vh;
  }

  .gps-controls-card {
    padding: 14px;
  }

  /* Coordinate form single column on mobile */
  .form-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .form-group input {
    width: 100%;
    box-sizing: border-box;
  }

  .btn-group {
    flex-wrap: wrap;
  }

  .primary-btn,
  .accent-btn,
  .danger-btn {
    flex: 1;
    padding: 10px 14px;
  }

  /* Route mode wrap */
  .mode-select {
    flex-wrap: wrap;
  }

  .mode-btn {
    min-width: 90px;
    padding: 8px 6px;
    font-size: 11px;
  }

  /* Sensor section responsive layout */
  .sensor-cols {
    gap: 14px;
  }

  .sensor-3d-panel {
    padding: 14px;
  }

  .phone-3d-container {
    width: 140px;
    height: 250px;
    margin: 16px 0;
  }

  .preset-actions-row {
    flex-wrap: wrap;
  }

  .preset-btn {
    min-width: 90px;
    padding: 8px 6px;
    font-size: 12px;
  }

  .slider-group-box {
    padding: 12px;
  }

  .slider-row label {
    width: 64px;
    font-size: 11px;
  }

  .val-display {
    width: 56px;
    font-size: 11px;
  }
}
</style>
