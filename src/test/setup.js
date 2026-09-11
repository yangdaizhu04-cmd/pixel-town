// Vitest 全局测试环境补丁：jsdom 缺的浏览器 API 在这里补齐
// （smoke 测试要真的挂载页面组件，页面里有 canvas 精灵、GSAP matchMedia、天气/诗词 fetch）
import { vi } from 'vitest'

// 1) Canvas 2D 上下文：jsdom 不实现，直接返回 no-op 桩（fillRect/clearRect/fillText/scale 等全部吞掉）
const ctx2d = new Proxy(
  { measureText: () => ({ width: 0 }) },
  {
    get: (t, k) => {
      if (k in t) return t[k]
      return () => {}
    },
    set: (t, k, v) => { t[k] = v; return true },
  },
)
HTMLCanvasElement.prototype.getContext = () => ctx2d
HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,'

// 2) matchMedia：GSAP matchMedia / 动效判断依赖它（统一返回不匹配，动画分支直接跳过）
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (q) => ({
    matches: false,
    media: q,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })
}

// 3) 滚动 API：jsdom 会打 "Not implemented" 错误日志，替换成安静桩
if (typeof window !== 'undefined') window.scrollTo = () => {}

// 4) fetch：一律离线失败 → news/weather/poem 走各自的 catch/兜底分支，测试不依赖真实网络
// （个别测试需要网络行为时自行 vi.stubGlobal 覆盖即可）
vi.stubGlobal('fetch', () => Promise.reject(new TypeError('offline-test')))
