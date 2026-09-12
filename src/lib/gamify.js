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
  goal: { xp: 30, coins: 15 }, // 月度目标达成（大目标给大奖；撤销不发也不追回，宽恕优先）
}

// ---------- 任务难度（做难事和划水终于有区别了） ----------
export const DIFFS = [
  { id: 1, icon: '🌱', label: '简单' },
  { id: 2, icon: '⭐', label: '普通' },
  { id: 3, icon: '🔥', label: '困难' },
]
export const DIFF_MULT = { 1: 0.6, 2: 1, 3: 1.6 }
export const diffOf = (x) => DIFFS.find((d) => d.id === (x?.diff || 2)) || DIFFS[1]
// 按难度缩放奖励（四舍五入，至少保底 1 XP/1 金币）
export const rewardBy = (base, diff) => ({
  xp: Math.max(1, Math.round(base.xp * (DIFF_MULT[diff] ?? 1))),
  coins: Math.max(1, Math.round(base.coins * (DIFF_MULT[diff] ?? 1))),
})

export const MILESTONES = [
  { at: 25, coins: 8, label: '小奖箱' },
  { at: 50, coins: 12, label: '大奖箱' },
  { at: 80, coins: 16, label: '黄金箱' },
  { at: XP_GOAL, coins: 25, label: '传说箱' },
]

// ---------- 盲盒：金额随机浮动 ±30%，8% 概率开「惊喜」（解锁新种子或金币兜底） ----------
export function rollChest(base) {
  const coins = Math.max(4, Math.round(base * (0.7 + Math.random() * 0.6)))
  return { coins, bonus: Math.random() < 0.08 }
}

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
      case 'alarm': [880, 880, 1175].forEach((f, i) => tone(f, i * 0.18, 0.16)); break
      case 'buy': tone(659, 0, 0.07); tone(988, 0.07, 0.07); tone(1319, 0.14, 0.12); break
      default: break
    }
  } catch { /* 音频不可用时静默 */ }
}
