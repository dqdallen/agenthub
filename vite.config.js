import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0', // 监听所有地址
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: (proxy, options) => {
          if (process.env.NODE_ENV === 'development') {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              console.log('=== Vite Proxy Request ===')
              console.log('URL:', req.url)
            })
          }
        }
      },
    },
  },
})
