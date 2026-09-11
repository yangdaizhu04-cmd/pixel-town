// gamify.js 纯逻辑单元测试：奖励数值 / 难度缩放 / 盲盒 / 事件总线
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  xpNeeded, XP_GOAL, REWARDS, DIFFS, DIFF_MULT, diffOf, rewardBy,
  MILESTONES, rollChest, WATER_COST, reward, emitConfetti, on, emit, setMuted, sfx,
} from '../gamify.js'

afterEach(() => { vi.restoreAllMocks() })

describe('gamify.js 数值设计', () => {
  it('xpNeeded 逐级递增', () => {
    expect(xpNeeded(1)).toBe(60)
    expect(xpNeeded(2)).toBe(100)
    expect(xpNeeded(3)).toBe(140)
  })

  it('难度定义齐全且 diffOf 有默认值', () => {
    expect(DIFFS).toHaveLength(3)
    expect(DIFFS.map((d) => d.id)).toEqual([1, 2, 3])
    expect(DIFF_MULT[1]).toBe(0.6)
    expect(DIFF_MULT[2]).toBe(1)
    expect(DIFF_MULT[3]).toBe(1.6)
    expect(diffOf({ diff: 3 }).id).toBe(3)
    expect(diffOf(undefined).id).toBe(2)
    expect(diffOf({}).id).toBe(2)
    expect(diffOf({ diff: 99 }).id).toBe(2)
  })

  it('rewardBy 按难度缩放并四舍五入，至少保底 1', () => {
    expect(rewardBy({ xp: 10, coins: 5 }, 1)).toEqual({ xp: 6, coins: 3 })
    expect(rewardBy({ xp: 10, coins: 5 }, 2)).toEqual({ xp: 10, coins: 5 })
    expect(rewardBy({ xp: 10, coins: 5 }, 3)).toEqual({ xp: 16, coins: 8 })
    expect(rewardBy({ xp: 1, coins: 1 }, 1)).toEqual({ xp: 1, coins: 1 })
  })

  it('REWARDS 各行为都有正向奖励', () => {
    for (const k of ['todo', 'habit', 'english', 'weight', 'review']) {
      expect(REWARDS[k].xp).toBeGreaterThan(0)
      expect(REWARDS[k].coins).toBeGreaterThan(0)
    }
  })

  it('MILESTONES 从小奖箱到传说箱递增', () => {
    expect(MILESTONES[0]).toEqual({ at: 25, coins: 8, label: '小奖箱' })
    expect(MILESTONES[MILESTONES.length - 1].at).toBe(XP_GOAL)
    for (let i = 1; i < MILESTONES.length; i++) {
      expect(MILESTONES[i].at).toBeGreaterThan(MILESTONES[i - 1].at)
    }
  })

  it('WATER_COST 每次浇水 2 金币', () => {
    expect(WATER_COST).toBe(2)
  })
})

describe('rollChest 盲盒', () => {
  it('随机数决定金额：±30% 区间内', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(rollChest(10).coins).toBe(7)
    vi.spyOn(Math, 'random').mockReturnValue(1)
    expect(rollChest(10).coins).toBe(13)
  })

  it('8% 概率开出惊喜', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(rollChest(10).bonus).toBe(true)
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    expect(rollChest(10).bonus).toBe(false)
  })

  it('金额有下限 4', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(rollChest(1).coins).toBeGreaterThanOrEqual(4)
  })
})

describe('reward / 事件总线', () => {
  it('派发 GRANT 并冒 toast', () => {
    const dispatch = vi.fn()
    const seen = []
    const off = on('toast', (e) => seen.push(e.detail))
    reward(dispatch, { xp: 10, coins: 5, msg: '完成', icon: '✨' })
    off()
    expect(dispatch).toHaveBeenCalledWith({ type: 'GRANT', xp: 10, coins: 5 })
    expect(seen).toHaveLength(1)
    expect(seen[0]).toMatchObject({ icon: '✨' })
    expect(seen[0].text).toContain('+10 XP')
    expect(seen[0].text).toContain('+5 金币')
    expect(seen[0].text).toContain('完成')
  })

  it('零奖励不发 toast，但可单独要求撒花', () => {
    const dispatch = vi.fn()
    const toasts = []
    const confettis = []
    const off1 = on('toast', (e) => toasts.push(e.detail))
    const off2 = on('confetti', (e) => confettis.push(e.detail))
    reward(dispatch, { confetti: true })
    off1()
    off2()
    expect(toasts).toHaveLength(0)
    expect(confettis).toEqual([{ n: 26 }])
  })

  it('emit / on 可订阅与退订', () => {
    const fn = vi.fn()
    const off = on('x', fn)
    emit('x', { a: 1 })
    off()
    emit('x', { a: 2 })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('emitConfetti 触发 confetti 事件', () => {
    const seen = []
    const off = on('confetti', (e) => seen.push(e.detail))
    emitConfetti(5, 1, 2)
    off()
    expect(seen).toEqual([{ n: 5, x: 1, y: 2 }])
  })

  it('静音后 sfx 直接返回；任意名字都不抛异常', () => {
    setMuted(true)
    expect(() => sfx('coin')).not.toThrow()
    setMuted(false)
    expect(() => sfx('unknown-name')).not.toThrow()
  })
})