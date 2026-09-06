import { dayKey } from './dates.js'

// ---------- 全局事件总线（toast / confetti / levelup） ----------
export const bus = new EventTarget()
export const emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }))
export const on = (type, fn) => {
  bus.addEventListener(type, fn)
  return () => bus.removeEventListener(type, fn)
}

// ---------- 数值设计（宽恕优先，只奖励不惩罚） ----------
export const xpNeeded = (lvl) => 60 + (lvl - 1) * 40
export const XP_GOAL = 120 // 每日冒险进度目标

export const REWARDS = {
  todo: { xp: 10, coins: 5 },
  habit: { xp: 8, coins: 3 },
  english: { xp: 4, coins: 1 },
  weight: { xp: 5, coins: 2 },
  review: { xp: 15, coins: 5 },
}

export const MILESTONES = [
  { at: 25, coins: 8, label: '小奖箱' },
  { at: 50, coins: 12, label: '大奖箱' },
  { at: 80, coins: 16, label: '黄金箱' },
  { at: XP_GOAL, coins: 25, label: '传说箱' },
]

export const WATER_COST = 2 // 每天第一次免费，之后消耗金币

// ---------- 奖励：派发 + 冒泡 ----------
export function reward(dispatch, { xp = 0, coins = 0, msg = '', icon = '✨', confetti = false } = {}) {
  dispatch({ type: 'GRANT', xp, coins })
  if (xp || coins) {
    emit('toast', {
      icon,
      text: `+${xp} XP${coins ? ` · +${coins} 金币` : ''}${msg ? ` · ${msg}` : ''}`,
    })
  }
  if (confetti) emit('confetti', { n: 26 })
}

export const emitConfetti = (n = 24, x, y) => emit('confetti', { n, x, y })

// ---------- 8-bit 音效（WebAudio 方波小旋律） ----------
let audioCtx = null
let muted = false
export const setMuted = (m) => { muted = m }

function tone(freq, start, dur, vol = 0.04, type = 'square') {
  const t0 = audioCtx.currentTime + start
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(gain).connect(audioCtx.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

export function sfx(name) {
  if (muted) return
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    if (audioCtx.state === 'suspended') audioCtx.resume()
    switch (name) {
      case 'click': tone(660, 0, 0.06); break
      case 'check': tone(523, 0, 0.08); tone(784, 0.07, 0.1); break
      case 'coin': tone(988, 0, 0.07); tone(1319, 0.07, 0.12); break
      case 'water': tone(392, 0, 0.1, 0.03, 'triangle'); tone(523, 0.09, 0.12, 0.03, 'triangle'); tone(659, 0.18, 0.14, 0.03, 'triangle'); break
      case 'levelup': [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.14)); break
      case 'pop': tone(440, 0, 0.05); break
      case 'oops': tone(220, 0, 0.12, 0.03); break
      default: break
    }
  } catch { /* 音频不可用时静默 */ }
}
