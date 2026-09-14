/**
 * Cloud Phone Web Console - Full Simulation Demo Engine (Mock Engine)
 * Active only when VITE_DEMO_MODE=true, providing full mock device matrix and interactions
 */

export const MOCK_DEVICES = [
  {
    id: "Pixel-6Pro-ARM64",
    info: {
      model: "Google Pixel 6 Pro",
      abi: "arm64-v8a",
      sdk: "31",
      androidVersion: "12.0",
      ip: "192.168.1.101",
      sn: "PX6P-2026-001"
    },
    status: "online",
    tags: ["High-Perf", "ARM64"],
    firstSeen: "2026-07-24T08:00:00Z",
    lastSeen: "2026-07-24T12:00:00Z",
    stats: { cpu: 18.4, mem: 48.2, disk: 42.1, temp: 36.5, netUp: 1250, netDown: 3420 }
  },
  {
    id: "Redroid-S22-Container",
    info: {
      model: "Samsung Galaxy S22 (redroid)",
      abi: "x86_64",
      sdk: "31",
      androidVersion: "12.0",
      ip: "172.18.0.12",
      sn: "REDROID-S22-002"
    },
    status: "online",
    tags: ["redroid", "Container"],
    firstSeen: "2026-07-24T08:10:00Z",
    lastSeen: "2026-07-24T12:00:00Z",
    stats: { cpu: 32.1, mem: 62.5, disk: 35.0, temp: 41.2, netUp: 890, netDown: 2100 }
  },
  {
    id: "Xiaomi13-Magisk-v030",
    info: {
      model: "Xiaomi 13 (Magisk Service)",
      abi: "arm64-v8a",
      sdk: "33",
      androidVersion: "13.0",
      ip: "192.168.1.155",
      sn: "XM13-MAGISK-003"
    },
    status: "online",
    tags: ["Magisk-KeepAlive", "v0.3.0"],
    firstSeen: "2026-07-24T09:00:00Z",
    lastSeen: "2026-07-24T12:00:00Z",
    stats: { cpu: 12.8, mem: 41.0, disk: 55.4, temp: 35.1, netUp: 2150, netDown: 5800 }
  },
  {
    id: "OnePlus11-Shizuku-ADB",
    info: {
      model: "OnePlus 11 (Shizuku Engine)",
      abi: "arm64-v8a",
      sdk: "33",
      androidVersion: "13.0",
      ip: "192.168.1.188",
      sn: "OP11-SHIZUKU-004"
    },
    status: "online",
    tags: ["Shizuku-NoRoot", "Wireless-ADB"],
    firstSeen: "2026-07-24T09:30:00Z",
    lastSeen: "2026-07-24T12:00:00Z",
    stats: { cpu: 22.5, mem: 51.3, disk: 60.1, temp: 38.0, netUp: 1400, netDown: 3100 }
  },
  {
    id: "CloudPhone-Tensor-v030",
    info: {
      model: "Google Tensor Cloud Engine",
      abi: "arm64-v8a",
      sdk: "32",
      androidVersion: "12.1",
      ip: "10.0.8.50",
      sn: "TENSOR-CLOUD-005"
    },
    status: "online",
    tags: ["High-Quality", "v0.3.0"],
    firstSeen: "2026-07-24T10:00:00Z",
    lastSeen: "2026-07-24T12:00:00Z",
    stats: { cpu: 15.2, mem: 45.8, disk: 28.9, temp: 34.8, netUp: 3100, netDown: 7200 }
  },
  {
    id: "CloudPhone-Offline-Node6",
    info: {
      model: "Qualcomm Snapdragon Node (Offline)",
      abi: "arm64-v8a",
      sdk: "30",
      androidVersion: "11.0",
      ip: "192.168.1.200",
      sn: "NODE-OFFLINE-006"
    },
    status: "offline",
    tags: ["Offline", "Maintenance"],
    firstSeen: "2026-07-20T08:00:00Z",
    lastSeen: "2026-07-24T04:00:00Z",
    lastOffline: "2026-07-24T04:05:00Z",
    stats: { cpu: 0, mem: 0, disk: 0, temp: 0, netUp: 0, netDown: 0 }
  }
]

// Programmatically generate up to 100 devices for grid/dashboard validation
// (First 6 devices retain manual detail; generated devices have randomized models/tags/metrics)
const DEMO_MODELS = [
  { model: "Google Pixel 7 Pro", abi: "arm64-v8a", sdk: "33", androidVersion: "13.0" },
  { model: "Samsung Galaxy S23 (redroid)", abi: "x86_64", sdk: "33", androidVersion: "13.0" },
  { model: "Xiaomi 14 (Magisk Service)", abi: "arm64-v8a", sdk: "34", androidVersion: "14.0" },
  { model: "OnePlus 12 (Shizuku Engine)", abi: "arm64-v8a", sdk: "34", androidVersion: "14.0" },
  { model: "Redroid Container Node", abi: "x86_64", sdk: "31", androidVersion: "12.0" }
]
const DEMO_TAG_POOL = [["High-Perf"], ["redroid", "Container"], ["Magisk-KeepAlive"], ["Shizuku-NoRoot"], ["High-Quality"], ["Test-Group"], ["Gaming"], []]

function pad3(n) {
  return String(n).padStart(3, "0")
}

function seededRand(seed) {
  // Reproducible pseudo-random generator for stable UI layout across refreshes
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

for (let i = MOCK_DEVICES.length + 1; i <= 100; i++) {
  const rand = seededRand(i * 9973)
  const spec = DEMO_MODELS[Math.floor(rand() * DEMO_MODELS.length)]
  const online = rand() > 0.12 // ~88% online
  const hoursAgo = Math.floor(rand() * 72)
  const lastSeen = new Date(Date.UTC(2026, 6, 24, 12) - hoursAgo * 3600000).toISOString()
  const dev = {
    id: `CloudPhone-VM-${pad3(i)}`,
    info: {
      model: spec.model,
      abi: spec.abi,
      sdk: spec.sdk,
      androidVersion: spec.androidVersion,
      ip: `10.8.${Math.floor(i / 250)}.${i % 250 + 1}`,
      sn: `CP-VM-${pad3(i)}`
    },
    status: online ? "online" : "offline",
    tags: DEMO_TAG_POOL[Math.floor(rand() * DEMO_TAG_POOL.length)],
    firstSeen: "2026-07-20T08:00:00Z",
    lastSeen,
    stats: online
      ? {
          cpu: +(10 + rand() * 60).toFixed(1),
          mem: +(35 + rand() * 40).toFixed(1),
          disk: +(20 + rand() * 50).toFixed(1),
          temp: +(33 + rand() * 12).toFixed(1),
          netUp: Math.floor(200 + rand() * 3000),
          netDown: Math.floor(500 + rand() * 7000)
        }
      : { cpu: 0, mem: 0, disk: 0, temp: 0, netUp: 0, netDown: 0 }
  }
  if (!online) {
    dev.lastOffline = lastSeen
  }
  MOCK_DEVICES.push(dev)
}

/**
 * Online device high-frequency telemetry simulation
 */
export function startMockStatsGenerator(onUpdate) {
  const timer = setInterval(() => {
    MOCK_DEVICES.forEach(dev => {
      if (dev.status === 'online') {
        // Small fluctuations
        dev.stats.cpu = Math.max(8, Math.min(85, +(dev.stats.cpu + (Math.random() * 6 - 3)).toFixed(1)))
        dev.stats.mem = Math.max(30, Math.min(80, +(dev.stats.mem + (Math.random() * 2 - 1)).toFixed(1)))
        dev.stats.temp = Math.max(32, Math.min(48, +(dev.stats.temp + (Math.random() * 0.4 - 0.2)).toFixed(1)))
        dev.stats.netUp = Math.max(200, +(dev.stats.netUp + Math.floor(Math.random() * 400 - 200)))
        dev.stats.netDown = Math.max(500, +(dev.stats.netDown + Math.floor(Math.random() * 800 - 400)))
      }
    })
    if (typeof onUpdate === 'function') {
      onUpdate([...MOCK_DEVICES])
    }
  }, 2000)

  return () => clearInterval(timer)
}

/**
 * High-fidelity Live Canvas viewport simulator
 */
export function renderMockScreenCanvas(canvas, deviceId, touchRipples = []) {
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const width = canvas.width || 360
  const height = canvas.height || 640

  // 1. Dark background
  ctx.fillStyle = '#0b0f19'
  ctx.fillRect(0, 0, width, height)

  // 2. Geometric grid glow
  const grad = ctx.createLinearGradient(0, 0, width, height)
  grad.addColorStop(0, '#0f172a')
  grad.addColorStop(1, '#020617')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, width, height)

  // 3. Top Android status bar
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
  ctx.font = '11px sans-serif'
  const timeStr = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  ctx.fillText(timeStr, 14, 20)
  ctx.fillText('5G  🔋95%', width - 65, 20)

  // 4. Cloud Phone title and model
  ctx.fillStyle = '#38bdf8'
  ctx.font = 'bold 14px sans-serif'
  ctx.fillText(deviceId || 'CloudPhone-v0.3.0', 14, 48)

  // 5. Simulated wallpaper and app icons (4x4 Grid)
  const icons = [
    { name: 'Settings', color: '#6366f1', icon: '⚙️' },
    { name: 'Files', color: '#06b6d4', icon: '📁' },
    { name: 'Camera', color: '#10b981', icon: '📷' },
    { name: 'Terminal', color: '#f59e0b', icon: '💻' },
    { name: 'Agent', color: '#3b82f6', icon: '🚀' },
    { name: 'Magisk', color: '#ec4899', icon: '🧩' },
    { name: 'Monitor', color: '#8b5cf6', icon: '📈' },
    { name: 'AI Copilot', color: '#14b8a6', icon: '🤖' }
  ]

  const colWidth = width / 4
  const startY = 80
  icons.forEach((item, i) => {
    const col = i % 4
    const row = Math.floor(i / 4)
    const x = col * colWidth + colWidth / 2
    const y = startY + row * 75

    // Icon rounded rectangle
    ctx.fillStyle = item.color
    ctx.beginPath()
    ctx.roundRect(x - 18, y - 18, 36, 36, 10)
    ctx.fill()

    // Emoji icon text
    ctx.font = '18px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(item.icon, x, y + 6)

    // Label description
    ctx.fillStyle = '#94a3b8'
    ctx.font = '10px sans-serif'
    ctx.fillText(item.name, x, y + 30)
  })

  // 6. Bottom touch ripple animation feedback
  touchRipples.forEach(r => {
    ctx.strokeStyle = `rgba(56, 189, 248, ${r.alpha})`
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2)
    ctx.stroke()
  })

  ctx.textAlign = 'left' // Reset default alignment
}

/**
 * Simulated Shell command responses
 */
export function getMockShellOutput(command) {
  const cmd = (command || '').trim().toLowerCase()
  if (cmd.startsWith('ls')) {
    return `total 48
drwxrwx--x 15 root root 4096 Jul 24 10:00 .
drwxrwx--x 15 root root 4096 Jul 24 10:00 ..
drwxrwx---  2 root root 4096 Jul 24 10:05 Download
drwxrwx---  3 root root 4096 Jul 24 10:02 DCIM
drwxrwx---  2 root root 4096 Jul 24 10:01 Documents
-rw-rw----  1 root root  128 Jul 24 11:30 config.conf`
  }
  if (cmd.startsWith('top')) {
    return `Tasks: 142 total,   1 running, 141 sleeping
%Cpu(s):  8.2 us,  2.1 sy,  0.0 ni, 89.7 id,  0.0 wa
KiB Mem :  8048128 total,  3210440 free,  2432018 used
  PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND
 1204 shell     20   0 1048576  48200  32100 S   5.2   0.6   0:15.22 cloudphone-agent
 2314 root      20   0 2048576 128400  88200 S   3.1   1.6   0:42.10 libsys_core.so
  840 system    20   0 4820192 342000 180000 S   2.0   4.2   1:12.50 system_server`
  }
  if (cmd.startsWith('getprop')) {
    return `[ro.product.model]: [Google Pixel 6 Pro]
[ro.build.version.release]: [12]
[ro.build.version.sdk]: [31]
[ro.product.cpu.abi]: [arm64-v8a]
[cloudphone.agent.version]: [v0.3.0]
[cloudphone.app.version]: [v0.3.1]`
  }
  return `[Mock ADB Shell]: Executed '${command}' successfully. (exit 0)`
}

/**
 * Simulated AI troubleshooting dialog responses
 */
export function getMockAIReply(prompt) {
  const p = (prompt || '').toLowerCase()
  if (p.includes('network') || p.includes('lag') || p.includes('delay') || p.includes('latency')) {
    return {
      trace: [
        "🔍 [AI Agent] Invoking tool: get_webrtc_stats()...",
        "📊 [RTT]: 18ms | [Jitter]: 2.1ms | [FPS]: 58.5 | [PacketLoss]: 0.0%",
        "⚡ [HW-PTS]: PTS timestamp parsing normal, avg frame interval 16.6ms",
        "💡 [Diagnosis]: Network quality is excellent with 0% packet loss and no latency build-up."
      ],
      reply: "Based on real-time WebRTC Stats, throughput and latency metrics remain optimal (RTT: 18ms, packet loss: 0.0%). Stream is highly stable!"
    }
  }
  return {
    trace: [
      "🔍 [AI Agent] Invoking tool: get_device_info()...",
      "📱 [Device Model]: Google Pixel 6 Pro (ARM64-v8a)",
      "🚀 [Agent Status]: Running (PID: 1204 | CoreService: Connected)"
    ],
    reply: `Command received! Device is healthy. Agent (v0.3.0) is active as a background service and ready to execute actions.`
  }
}
