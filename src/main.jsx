import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './assets/fonts/index.css' // 子集化中文字体（仅含本项目用到的字符，运行时接口/输入的中文走系统字体兜底）
import './styles/global.css'
import App from './App.jsx'
import { AppProvider } from './lib/store.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
)

// PWA：注册 Service Worker，让整站可「添加到主屏幕 + 离线打开」。
// 只在生产构建注册：dev 态 vite 大量模块，缓存会干扰 HMR；file:// 直开没有 http 上下文会静默失败。
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* 无需打扰用户 */ })
  })
}