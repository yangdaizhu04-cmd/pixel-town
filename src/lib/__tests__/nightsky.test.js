import { describe, it, expect } from 'vitest'
import { makeStars, spawnMeteor, stepMeteor, rng } from '../nightsky.js'

describe('nightsky 纯逻辑', () => {
  it('makeStars 数量正确、坐标在画布内、避开底部山丘区、吸附 2px 网格', () => {
    const stars = makeStars(800, 600, 50, rng(7))
    expect(stars).toHaveLength(50)
    for (const s of stars) {
      expect(s.x).toBeGreaterThanOrEqual(0)
      expect(s.x).toBeLessThan(800)
      expect(s.y).toBeGreaterThanOrEqual(0)
      expect(s.y).toBeLessThanOrEqual(600 * 0.75)
      expect([2, 4]).toContain(s.s)
      expect(s.x % 2).toBe(0)
      expect(s.y % 2).toBe(0)
    }
  })

  it('同一 seed 布局完全一致（resize 重绘星星不跳变）', () => {
    expect(makeStars(800, 600, 30, rng(3))).toEqual(makeStars(800, 600, 30, rng(3)))
  })

  it('流星步进：最终飞出画布返回 null（不会永远活着）', () => {
    const w = 800
    const h = 600
    let cur = spawnMeteor(w, h, rng(1))
    let guard = 0
    while (cur && guard++ < 1000) cur = stepMeteor(cur, w, h)
    expect(cur).toBeNull()
  })

  it('stepMeteor 不会原地修改传入的流星（纯函数）', () => {
    const m = spawnMeteor(800, 600, rng(2))
    const before = { ...m }
    stepMeteor(m, 800, 600)
    expect(m).toEqual(before)
  })
})
