// 番茄钟模块（时间戳计时）的单元测试：用 fake timers 推进时间验证「到点发事件」
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { pomoStart, pomoSnap, pomoReset, pomoStop, pomoSetBreak, pomoIsRunning } from '../pomo.js'
import { on } from '../gamify.js'

describe('番茄钟', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-07T02:00:00Z'))
  })
  afterEach(() => {
    pomoStop()
    vi.useRealTimers()
  })

  it('pomoStart 进入运行态，总时长按分钟换算成秒', () => {
    pomoStart(0.5, '', 'focus')
    expect(pomoIsRunning()).toBe(true)
    expect(pomoSnap().total).toBe(30)
    expect(pomoSnap().left).toBe(30)
  })

  it('时间走完触发 pomo-done，带着 分钟/计划/模式', () => {
    const done = vi.fn()
    const off = on('pomo-done', (e) => done(e.detail))
    pomoStart(0.5, 'plan-1', 'focus')
    vi.advanceTimersByTime(31 * 1000)
    expect(done).toHaveBeenCalledTimes(1)
    expect(done).toHaveBeenCalledWith({ min: 1, planId: 'plan-1', mode: 'focus' })
    expect(pomoIsRunning()).toBe(false)
    off()
  })

  it('休息轮结束也发事件但不挂计划', () => {
    const done = vi.fn()
    const off = on('pomo-done', (e) => done(e.detail))
    pomoSetBreak(1)
    pomoStart(0.5, '', 'break')
    vi.advanceTimersByTime(31 * 1000)
    expect(done).toHaveBeenCalledWith({ min: 1, planId: '', mode: 'break' })
    off()
  })

  it('pomoReset 停表并把剩余/总长重置', () => {
    pomoStart(1, 'p1', 'focus')
    pomoReset(25, 'x', 'focus')
    expect(pomoIsRunning()).toBe(false)
    expect(pomoSnap().total).toBe(25 * 60)
    expect(pomoSnap().left).toBe(pomoSnap().total)
  })

  it('pomoSetBreak 钳制在 1-60 分钟，非法/空输入回退 5', () => {
    pomoSetBreak(200)
    expect(pomoSnap().breakMin).toBe(60)
    pomoSetBreak('abc')
    expect(pomoSnap().breakMin).toBe(5)
    pomoSetBreak(0) // 0 视作未填 → 回退默认 5（应用刻意行为）
    expect(pomoSnap().breakMin).toBe(5)
  })
})