import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/naver-fchart': {
        target: 'https://fchart.stock.naver.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/naver-fchart/, ''),
      },
      '/naver-api': {
        target: 'https://m.stock.naver.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/naver-api/, ''),
      },
    },
  },
})
