// 每日一问题库的单元测试
import { describe, it, expect } from 'vitest'
import { QUESTIONS, questionOf } from '../questions.js'
import { addDays } from '../dates.js'

describe('questions：每日一问', () => {
  it('题库非空且无重复', () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(50)
    expect(new Set(QUESTIONS).size).toBe(QUESTIONS.length)
  })

  it('同一天的问题稳定', () => {
    expect(questionOf('2026-09-09')).toBe(questionOf('2026-09-09'))
  })

  it('补写历史日期给的是那一天的问题（跨天会轮换）', () => {
    const days = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04']
    days.forEach((d) => {
      expect(QUESTIONS).toContain(questionOf(d))
    })
    // 60 个问题按 hash 轮换，连续几天大概率不同（真出现全同说明 hash 退化，值得报警）
    expect(new Set(days.map(questionOf)).size).toBeGreaterThan(1)
  })

  it('相邻日期（跨月/跨年）也不越界', () => {
    expect(QUESTIONS).toContain(questionOf(addDays('2026-12-31', 1)))
    expect(QUESTIONS).toContain(questionOf('2024-02-29'))
  })
})
