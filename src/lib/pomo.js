// ---------- 番茄钟：模块级单例，页面切走也在跑 ----------
// 为什么不用 React state：番茄钟要跨页面存活，挂在小程序模块里最稳；
// 计时用「结束时间戳」而不是累加 interval：浏览器后台标签页会节流 setInterval，
// 累加式计时会越走越慢，时间戳取差值永远准确。
import { emit } from './gamify.js'

const st = {
  running: false,
  endAt: 0,     // 结束时刻（ms），暂停时无效
  left: 25 * 60, // 剩余秒数
  total: 25 * 60,
  planId: '',   // 挂到哪个学习计划；空 = 自由专注
}

const subs = new Set()
let timer = null

const snap = () => ({ ...st })
const tell = () => subs.forEach((f) => f(snap()))

function tick() {
  st.left = Math.max(0, Math.round((st.endAt - Date.now()) / 1000))
  tell()
  if (st.left <= 0) {
    const min = Math.round(st.total / 60)
    const planId = st.planId
    stopLoop()
    st.running = false
    st.left = st.total
    tell()
    emit('pomo-done', { min, planId })
  }
}

function startLoop() {
  stopLoop()
  timer = setInterval(tick, 250)
}
function stopLoop() {
  if (timer) { clearInterval(timer); timer = null }
}

export function pomoSubscribe(f) {
  subs.add(f)
  return () => subs.delete(f)
}

export function pomoStart(min, planId = '') {
  st.total = Math.max(1, Math.round(min * 60))
  st.left = st.total
  st.endAt = Date.now() + st.left * 1000
  st.planId = planId
  st.running = true
  startLoop()
  tell()
}

export function pomoPause() {
  if (!st.running) return
  stopLoop()
  st.running = false
  tell()
}

export function pomoResume() {
  if (st.running || st.left <= 0) return
  st.endAt = Date.now() + st.left * 1000
  st.running = true
  startLoop()
  tell()
}

export function pomoReset(min = st.total / 60, planId = st.planId) {
  stopLoop()
  st.running = false
  st.total = Math.max(1, Math.round(min * 60))
  st.left = st.total
  st.planId = planId
  tell()
}

export function pomoStop() {
  stopLoop()
  st.running = false
  st.left = st.total
  tell()
}

export const pomoIsRunning = () => st.running

// 开发测试钩子：dev 模式下把 3 秒的「迷你番茄」挂到 window，供自动化冒烟用
if (import.meta.env.DEV) {
  window.__pomo = { startTiny: () => pomoStart(0.05) }
}
