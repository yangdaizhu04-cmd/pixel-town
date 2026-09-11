// ---------- 上周小镇周报：把散在各处的数据聚成一张本周卡片 ----------
// 纯函数 + 单一入口，方便单元测试；周定义为「周一到周日」（周一是一周的开始）。
import { dayKey, addDays, weekSpan } from './dates.js'

// 把 state 中落在 days 里的数据聚成一份指标
// （导出供 Review 页的每周小结按天复用：聚合口径只此一份，改字段只动这里）
export const aggregate = (state, days) => {
  const set = new Set(days)
  const todos = state.todos.filter((x) => (x.done && set.has(x.day)) || (x.repeat && set.has(x.lastDone))).length
  const habits = state.habits.reduce((m, h) => m + Object.keys(h.days || {}).filter((d) => set.has(d)).length, 0)
  const pomos = (state.pomoLog || []).filter((p) => set.has(p.t))
  const ledger = state.ledger.filter((x) => set.has(x.day))
  let income = 0
  let expense = 0
  for (const e of ledger) { if (e.type === 'in') income += e.amount; else expense += e.amount }
  return {
    todos,
    habits,
    pomos: pomos.length,
    focusMin: pomos.reduce((m, p) => m + (p.min || 0), 0),
    ledger: ledger.length,
    income,
    expense,
    reviews: Object.keys(state.reviews || {}).filter((d) => set.has(d)).length,
    xp: days.reduce((m, d) => m + (state.xpLog?.[d] || 0), 0),
  }
}

// 本周 vs 上周的完整报告（本周在前，环比差在后）
export function weeklyReport(state, end = dayKey()) {
  const thisWeek = aggregate(state, weekSpan(end))
  const lastWeek = aggregate(state, weekSpan(addDays(end, -7)))
  const diff = (k) => thisWeek[k] - lastWeek[k]
  return {
    days: weekSpan(end),
    thisWeek,
    lastWeek,
    diff: {
      todos: diff('todos'),
      habits: diff('habits'),
      pomos: diff('pomos'),
      focusMin: diff('focusMin'),
      ledger: diff('ledger'),
      income: diff('income'),
      expense: diff('expense'),
      reviews: diff('reviews'),
      xp: diff('xp'),
    },
  }
}