import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const isDemo = mode === 'demo'
  const proxyTarget = process.env.VITE_PROXY_TARGET || 'http://localhost:9000'
  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    },
    server: {
      port: 4000,
      proxy: {
        '/connect_client': {
          target: proxyTarget,
          ws: true,
          secure: false,
          changeOrigin: true
        },
        '/devices': {
          target: proxyTarget,
          secure: false,
          changeOrigin: true
        },
        '/register_agent': {
          target: proxyTarget,
          ws: true,
          secure: false,
          changeOrigin: true
        },
        '/agent': {
          target: proxyTarget,
          secure: false,
          changeOrigin: true
        },
        '/api': {
          target: proxyTarget,
          secure: false,
          changeOrigin: true
        },
        '/downloads': {
          target: proxyTarget,
          secure: false,
          changeOrigin: true
        }
      }
    },
    build: {
      outDir: process.env.VITE_OUT_DIR || (isDemo ? 'dist' : '../assets'),
      emptyOutDir: process.env.VITE_OUT_DIR ? true : (isDemo ? true : false)
    }
  }
})
