import './utils/cryptoPolyfill'

// Global Fetch interceptor: automatically inject Authorization Token and handle 401 responses
// Check if request is local/same-origin
const isLocalRequest = (url) => {
  if (!url) return false
  if (url.startsWith('/') && !url.startsWith('//')) {
    return true
  }
  try {
    const parsed = new URL(url, window.location.href)
    return parsed.host === window.location.host
  } catch (e) {
    return false
  }
}

const originalFetch = window.fetch
window.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : (input && input.url ? input.url : '')
  const isLocal = isLocalRequest(url)

  if (isLocal && url && !url.includes('/api/login') && !url.includes('/api/register')) {
    const token = localStorage.getItem('auth_token')
    if (token) {
      init.headers = init.headers || {}
      if (init.headers instanceof Headers) {
        init.headers.set('Authorization', `Bearer ${token}`)
      } else if (Array.isArray(init.headers)) {
        const hasAuth = init.headers.some(h => h[0]?.toLowerCase() === 'authorization')
        if (!hasAuth) {
          init.headers.push(['Authorization', `Bearer ${token}`])
        }
      } else {
        if (!init.headers['Authorization'] && !init.headers['authorization']) {
          init.headers['Authorization'] = `Bearer ${token}`
        }
      }
    }
  }

  const response = await originalFetch(input, init)
  if (isLocal && response.status === 401) {
    // Exclude share APIs (/api/share/), snapshots (/snapshots/), auth status (/api/auth-status), and login/register
    const isPublicOrShareApi = url.includes('/api/share/') || url.includes('/snapshots/') || url.includes('/api/auth-status')
    if (!isPublicOrShareApi && !url.includes('/api/login') && !url.includes('/api/register')) {
      try {
        const { useAuthStore } = await import('./stores/auth')
        const auth = useAuthStore()
        // Only clear token when not in no-auth mode and encountering 401 on core APIs
        if (!auth.noAuthMode) {
          localStorage.removeItem('auth_token')
          localStorage.removeItem('auth_user')
          auth.token = ''
          auth.username = ''
        }
      } catch (e) {}
    }
  }
  return response
}

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './styles/main.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
