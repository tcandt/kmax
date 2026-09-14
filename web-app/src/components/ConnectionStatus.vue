<template>
  <div class="connection-status" :class="statusClass">
    <span class="status-dot"></span>
    <span class="status-text">{{ statusText }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: {
    type: String,
    required: true
  }
})

const statusClass = computed(() => {
  const s = props.status
  if (s === 'connected') return 'connected'
  if (s === 'error' || s === 'disconnected') return 'error'
  return 'connecting'
})

const statusText = computed(() => {
  const s = props.status
  const map = {
    'disconnected': 'Disconnected',
    'connecting': 'Connecting',
    'signaling': 'Signaling',
    'waiting_offer': 'Waiting for Response',
    'connecting_webrtc': 'Connecting WebRTC',
    'connected': 'Connected',
    'error': 'Connection Failed'
  }
  return map[s] || s
})
</script>

<style scoped>
.connection-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.connected {
  background: rgba(0, 255, 0, 0.1);
  color: #00ff00;
}

.connected .status-dot {
  background: #00ff00;
  box-shadow: 0 0 8px #00ff00;
  animation: none;
}

.connecting {
  background: rgba(255, 165, 0, 0.1);
  color: #ffa500;
}

.connecting .status-dot {
  background: #ffa500;
}

.error {
  background: rgba(255, 0, 0, 0.1);
  color: #ff4444;
}

.error .status-dot {
  background: #ff4444;
  animation: none;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
