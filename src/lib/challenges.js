// ---------- 每周小挑战：每周一自动 roll 一个主题，达成自动发金币 ----------
// 宽恕优先：完不成本周就翻篇，不扣任何东西；下周 roll 新的（不重复上周）。
import { dayKey, addDays, weekKey, daysBetween } from './dates.js'

// 本周这 7 天（含未来几天也无妨，没数据自然记 0）
const weekSpan = (end = dayKey()) => {
  const mon = weekKey(end)
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i))
}

export const CHALLENGES = [
  {
    id: 'focus-180', icon: '🍅', name: '专注三小时', desc: '本周番茄专注累计 180 分钟', coins: 15, max: 180, unit: '分钟',
    now: (s, days) => (s.pomoLog || []).filter((p) => days.includes(p.t)).reduce((m, p) => m + (p.min || 0), 0),
  },
  {
    id: 'todos-15', icon: '📝', name: '十五件小事', desc: '本周完成 15 件待办', coins: 10, max: 15, unit: '件',
    now: (s, days) => s.todos.filter((x) => (x.done && days.includes(x.day)) || (x.repeat && days.includes(x.lastDone))).length,
  },
  {
    id: 'habits-20', icon: '✅', name: '习惯花园', desc: '本周点亮习惯 20 次', coins: 10, max: 20, unit: '次',
    now: (s, days) => s.habits.reduce((m, h) => m + Object.keys(h.days || {}).filter((d) => days.includes(d)).length, 0),
  },
  {
    id: 'ledger-10', icon: '🧾', name: '十条流水', desc: '本周记 10 笔收支', coins: 8, max: 10, unit: '笔',
    now: (s, days) => s.ledger.filter((x) => days.includes(x.day)).length,
  },
  {
    id: 'review-3', icon: '🌙', name: '三日复盘', desc: '本周完成 3 篇晚间复盘', coins: 12, max: 3, unit: '篇',
    now: (s, days) => Object.keys(s.reviews || {}).filter((d) => days.includes(d)).length,
  },
  {
    id: 'streak-5', icon: '🔥', name: '五日不离', desc: '本周连续投入 5 天', coins: 15, max: 5, unit: '天',
    // 连续投入只看最近状态：隔了两天没来就算本周断签
    now: (s, _days) => {
      const last = s.profile.lastActiveDay || ''
      const gap = daysBetween(last, dayKey())
      if (gap > 1) return 0
      return Math.min(5, s.profile.streak || 0)
    },
  },
]

export const challengeById = (id) => CHALLENGES.find((c) => c.id === id)

// 当前进度（已按 max 钳制）
export const challengeNow = (ch, state, end = dayKey()) => {
  if (!ch) return 0
  return Math.min(ch.max, Math.round(ch.now(state, weekSpan(end))) || 0)
}

// 本周生效的挑战（跨周后 weekly.week 是旧周 → 返回 null，由 App 负责重新 roll）
export const challengeOf = (state, end = dayKey()) => {
  const w = state.profile.weekly || {}
  if (!w.id || w.week !== weekKey(end)) return null
  const ch = challengeById(w.id)
  return ch ? { ...ch, cur: challengeNow(ch, state, end), claimed: !!w.claimed } : null
}