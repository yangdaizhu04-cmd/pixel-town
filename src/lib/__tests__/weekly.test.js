// 上周小镇周报 / 每周挑战 的单元测试
import { describe, it, expect } from 'vitest'
import { weeklyReport } from '../weekly.js'
import { challengeOf, challengeNow, challengeById, CHALLENGES } from '../challenges.js'
import { seed, reducer } from '../store.jsx'
import { dayKey, addDays, weekKey } from '../dates.js'

describe('weeklyReport：上周小镇周报', () => {
  it('本周的完成件数/专注/收支/复盘能被聚成指标（相对 seed 基线）', () => {
    const t = dayKey()
    const before = weeklyReport(seed())
    let s = seed()
    s = reducer(s, { type: 'TODO_ADD', text: '写测试', cat: '生活', prio: false, diff: 2 })
    s = reducer(s, { type: 'TODO_TOGGLE', id: s.todos.find((x) => !x.repeat).id })
    s = reducer(s, { type: 'POMO_DONE', min: 25, planId: '', h: 10 })
    s = reducer(s, { type: 'LEDGER_ADD', dir: 'out', amount: 30, cat: '餐饮', note: '' })
    s = reducer(s, { type: 'REVIEW_SAVE', day: t, mood: 0, good: 'a', thanks: 'b', tomorrow: 'c' })
    const r = weeklyReport(s)
    expect(r.thisWeek.todos).toBe(before.thisWeek.todos + 1)
    expect(r.thisWeek.pomos).toBe(before.thisWeek.pomos + 1)
    expect(r.thisWeek.focusMin).toBe(before.thisWeek.focusMin + 25)
    expect(r.thisWeek.expense).toBe(before.thisWeek.expense + 30)
    expect(r.thisWeek.reviews).toBe(before.thisWeek.reviews + 1)
  })

  it('上周和本周分开统计（环比差带符号）', () => {
    const lastWeekDay = addDays(dayKey(), -8)
    const before = weeklyReport(seed())
    let s = seed()
    s = reducer(s, { type: 'LEDGER_ADD', dir: 'out', amount: 100, cat: '学习', note: '', day: lastWeekDay })
    const r = weeklyReport(s)
    expect(r.thisWeek.expense).toBe(before.thisWeek.expense)
    expect(r.lastWeek.expense).toBe(before.lastWeek.expense + 100)
    expect(r.diff.expense).toBe(before.diff.expense - 100)
  })

  it('weekKey 找到周一（周是一周的开始）', () => {
    // 2026-09-08 是周二 → 所在周一 9-07；09-06 是周日 → 所在周一 08-31
    expect(weekKey('2026-09-08')).toBe('2026-09-07')
    expect(weekKey('2026-09-06')).toBe('2026-08-31')
  })
})

describe('每周挑战', () => {
  it('challengeNow 统计本周专注分钟并钳制到 max', () => {
    let s = seed()
    s = reducer(s, { type: 'POMO_DONE', min: 45, planId: '', h: 9 })
    s = reducer(s, { type: 'POMO_DONE', min: 60, planId: '', h: 10 })
    const ch = challengeById('focus-180')
    expect(challengeNow(ch, s, dayKey())).toBe(105)
  })

  it('达成并领取后 challengeOf 返回 claimed=true', () => {
    const s = { ...seed(), profile: { ...seed().profile, weekly: { week: weekKey(), id: 'todos-15', claimed: true } } }
    const ch = challengeOf(s)
    expect(ch).not.toBeNull()
    expect(ch.claimed).toBe(true)
  })

  it('跨周旧挑战返回 null（等 App 重新 roll）', () => {
    const s = { ...seed(), profile: { ...seed().profile, weekly: { week: '2020-01-06', id: 'todos-15', claimed: true } } }
    expect(challengeOf(s)).toBeNull()
  })

  it('挑战模板都有 now 函数且名称不重复', () => {
    expect(new Set(CHALLENGES.map((c) => c.id)).size).toBe(CHALLENGES.length)
    for (const c of CHALLENGES) expect(typeof c.now).toBe('function')
  })
})