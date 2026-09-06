import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// base './' + singlefile：build 产物是「一个」自包含的 dist/index.html，
// 字体外（字体已内联进 CSS 的 base64？—— singlefile 会把资源内联），
// 现代浏览器下双击即可离线打开，不用起服务器。
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  server: { host: true },
  test: { environment: 'jsdom' },
})
