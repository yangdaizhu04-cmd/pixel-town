// dates.js 纯函数单元测试（含新增的 weekSpan；greeting/timeOfDay 用假时钟固定时间）
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  dayKey, parseKey, addDays, lastNDays, monthKey, fmtShort, fmtLong,
  greeting, timeOfDay, daysBetween, weekKey, weekSpan, hashOf, pickByDay,
} from '../dates.js'

afterEach(() => { vi.useRealTimers() })

describe('dates.js 日期工具', () => {
  it('dayKey 输出 yyyy-mm-dd', () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(dayKey(new Date(2026, 11, 31))).toBe('2026-12-31')
  })

  it('parseKey 与 addDays 处理跨月跨年', () => {
    expect(dayKey(parseKey('2026-03-01'))).toBe('2026-03-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('lastNDays 返回含 end 的连续 n 天（升序）', () => {
    expect(lastNDays(3, '2026-09-11')).toEqual(['2026-09-09', '2026-09-10', '2026-09-11'])
  })

  it('monthKey / fmtShort / fmtLong', () => {
    expect(monthKey('2026-09-11')).toBe('2026-09')
    expect(fmtShort('2026-09-11')).toBe('9/11')
    expect(fmtLong('2026-09-11')).toBe('2026年9月11日 · 星期五')
  })

  it('greeting 按时段返回问候', () => {
    vi.useFakeTimers({ now: new Date('2026-09-11T05:00:00') })
    expect(greeting()).toBe('夜深了')
    vi.useFakeTimers({ now: new Date('2026-09-11T10:00:00') })
    expect(greeting()).toBe('早上好')
    vi.useFakeTimers({ now: new Date('2026-09-11T13:00:00') })
    expect(greeting()).toBe('中午好')
    vi.useFakeTimers({ now: new Date('2026-09-11T16:00:00') })
    expect(greeting()).toBe('下午好')
    vi.useFakeTimers({ now: new Date('2026-09-11T20:00:00') })
    expect(greeting()).toBe('晚上好')
  })

  it('timeOfDay 按时段返回小镇时段', () => {
    vi.useFakeTimers({ now: new Date('2026-09-11T05:00:00') })
    expect(timeOfDay()).toBe('night')
    vi.useFakeTimers({ now: new Date('2026-09-11T07:00:00') })
    expect(timeOfDay()).toBe('dawn')
    vi.useFakeTimers({ now: new Date('2026-09-11T12:00:00') })
    expect(timeOfDay()).toBe('day')
    vi.useFakeTimers({ now: new Date('2026-09-11T18:00:00') })
    expect(timeOfDay()).toBe('dusk')
    vi.useFakeTimers({ now: new Date('2026-09-11T22:00:00') })
    expect(timeOfDay()).toBe('night')
  })

  it('daysBetween 计算两个日期之差', () => {
    expect(daysBetween('2026-09-01', '2026-09-11')).toBe(10)
    expect(daysBetween('2026-09-11', '2026-09-01')).toBe(-10)
  })

  it('weekKey 是该周周一（周一为一周开始）', () => {
    expect(weekKey('2026-09-11')).toBe('2026-09-07')
    expect(weekKey('2026-09-07')).toBe('2026-09-07')
    expect(weekKey('2026-09-13')).toBe('2026-09-07')
  })

  it('weekSpan 返回该周连续 7 天（周一到周日）', () => {
    expect(weekSpan('2026-09-11')).toEqual([
      '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10',
      '2026-09-11', '2026-09-12', '2026-09-13',
    ])
  })

  it('hashOf 稳定且同输入同结果', () => {
    expect(hashOf('2026-09-11')).toBe(hashOf('2026-09-11'))
    expect(hashOf('a')).toBeGreaterThanOrEqual(0)
  })

  it('pickByDay 同一天（同 salt）一定选同一个', () => {
    const arr = ['甲', '乙', '丙', '丁']
    vi.useFakeTimers({ now: new Date('2026-09-11T10:00:00') })
    expect(pickByDay(arr)).toBe(pickByDay(arr))
    expect(arr).toContain(pickByDay(arr))
    expect(arr).toContain(pickByDay(arr, ':salt'))
    expect(pickByDay(arr.slice(0, 1))).toBe('甲')
  })
})