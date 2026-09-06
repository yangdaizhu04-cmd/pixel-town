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

// PWA：仅在 http(s) 下注册 Service Worker（file:// 双击打开时静默跳过，靠 singlefile 兜底）
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}