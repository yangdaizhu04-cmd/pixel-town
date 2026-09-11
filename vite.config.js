import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import fs from 'node:fs'

// base './' + singlefile：build 产物是「一个」自包含的 dist/index.html，
// 现代浏览器下双击即可离线打开，不用起服务器。
// 本地 HTTPS：scripts/https-setup.ps1 会在 .https/ 生成证书；存在则 dev/preview 自动走 https
// （PWA 的 Service Worker 只认 https/localhost，真机「安装到主屏幕」必须 https）。
const hasHttps = fs.existsSync('.https/cert.pem') && fs.existsSync('.https/key.pem')
const https = hasHttps ? { cert: fs.readFileSync('.https/cert.pem'), key: fs.readFileSync('.https/key.pem') } : undefined

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  server: { host: true, https },
  preview: { host: true, https },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.js'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**'],
      exclude: ['src/lib/__tests__/**'],
      reporter: ['text-summary'],
    },
  },
})
