// ---------- 番茄钟：模块级单例，页面切走也在跑 ----------
// 为什么不用 React state：番茄钟要跨页面存活，挂在小程序模块里最稳；
// 计时用「结束时间戳」而不是累加 interval：浏览器后台标签页会节流 setInterval，
// 累加式计时会越走越慢，时间戳取差值永远准确。
// v2.1：专注结束可自动接一段休息轮（休息不发奖励，纯劳逸提醒）。
import { emit } from './gamify.js'

const st = {
  running: false,
  endAt: 0,     // 结束时刻（ms），暂停时无效
  left: 25 * 60, // 剩余秒数
  total: 25 * 60,
  planId: '',   // 挂到哪个学习计划；空 = 自由专注
  mode: 'focus', // focus 专注 | break 休息
  breakMin: 5,  // 休息轮时长（分钟），专注结束后自动进入
}

const subs = new Set()
let timer = null

const snap = () => ({ ...st })
// 显示相关字段的签名：250ms 的 tick 里秒数往往没变，签名相同就不打扰订阅者
//（否则 PomoBadge/学习页/标签页标题每秒被无效重渲染 4 次）
let lastSig = ''
const sigOf = () => `${st.running}|${st.left}|${st.mode}|${st.total}|${st.planId}|${st.breakMin}`
const tell = () => {
  const sig = sigOf()
  if (sig === lastSig) return
  lastSig = sig
  subs.forEach((f) => f(snap()))
}

// 只读快照：给事件监听方（如 App 的休息轮提示）看当前状态用
export const pomoSnap = snap

function tick() {
  st.left = Math.max(0, Math.round((st.endAt - Date.now()) / 1000))
  tell()
  if (st.left <= 0) {
    const min = Math.round(st.total / 60)
    const planId = st.planId
    const mode = st.mode
    stopLoop()
    st.running = false
    st.left = st.total
    tell()
    emit('pomo-done', { min, planId, mode })
  }
}

function startLoop() {
  stopLoop()
  timer = setInterval(tick, 250)
}
function stopLoop() {
  if (timer) { clearInterval(timer); timer = null }
}

// 后台标签页会节流 setInterval（Chrome 节能甚至完全暂停），回到前台/重获焦点时立刻校准一次，
// 否则专注结束的提醒可能迟到几分钟
if (typeof document !== 'undefined') {
  const catchUp = () => { if (document.hidden === false) tick() }
  document.addEventListener('visibilitychange', catchUp)
  window.addEventListener('pageshow', () => tick())
}

export function pomoSubscribe(f) {
  subs.add(f)
  return () => subs.delete(f)
}

export function pomoStart(min, planId = '', mode = 'focus') {
  st.mode = mode
  st.total = Math.max(1, Math.round(min * 60))
  st.left = st.total
  st.endAt = Date.now() + st.left * 1000
  st.planId = planId
  st.running = true
  startLoop()
  tell()
}

// 专注结束后的休息轮：时长用设定好的 breakMin，不挂计划
export function pomoStartBreak() {
  pomoStart(st.breakMin, '', 'break')
}

export function pomoSetBreak(min) {
  const v = Math.min(60, Math.max(1, Math.round(+min || 5)))
  st.breakMin = v
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

export function pomoReset(min = st.total / 60, planId = st.planId, mode = st.mode) {
  stopLoop()
  st.running = false
  st.mode = mode
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
  window.__pomo = {
    startTiny: (mode = 'focus') => pomoStart(0.05, '', mode),
    snap: () => ({ ...st }),
  }
}
