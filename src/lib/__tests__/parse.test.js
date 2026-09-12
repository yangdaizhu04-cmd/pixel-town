// 中文日期词解析 / 记账捕捉 的单元测试
import { describe, it, expect } from 'vitest'
import { parseDateWords, parseLedgerCapture } from '../parse.js'
import { addDays } from '../dates.js'

// 固定「今天」= 2026-09-09（周三），避免用例随真实日期漂移
const TODAY = '2026-09-09'
const parse = (t) => parseDateWords(t, TODAY)

describe('parseDateWords：中文日期解析', () => {
  it('无日期词时返回 null + 原文', () => {
    expect(parse('交报告')).toEqual({ day: null, clean: '交报告' })
  })

  it('今天 / 明天 / 后天 / 大后天', () => {
    expect(parse('今天交房租').day).toBe(TODAY)
    expect(parse('明天开会').day).toBe(addDays(TODAY, 1))
    expect(parse('后天体检').day).toBe(addDays(TODAY, 2))
    expect(parse('大后天交报告').day).toBe(addDays(TODAY, 3))
    // clean 都剥掉了日期前缀
    expect(parse('明天开会').clean).toBe('开会')
  })

  it('周X：未来最近（含今天），过了就顺延一周', () => {
    // 2026-09-09 是周三
    expect(parse('周三游泳').day).toBe(TODAY)
    expect(parse('周五聚餐').day).toBe('2026-09-11')
    expect(parse('周一交周报').day).toBe('2026-09-14') // 本周一已过 → 下周一
    expect(parse('星期日大扫除').day).toBe('2026-09-13')
    expect(parse('礼拜二理发').day).toBe('2026-09-15')
  })

  it('下周X：严格指下一周', () => {
    expect(parse('下周三评审').day).toBe('2026-09-16')
    expect(parse('下周一晨会').day).toBe('2026-09-14')
  })

  it('M月D日 / M月D号：今年已过算明年', () => {
    expect(parse('3月5日交税').day).toBe('2027-03-05') // 今年 3 月已过 → 明年
    expect(parse('10月1号出游').day).toBe('2026-10-01')
  })

  it('日期词后面还能跟正常文字', () => {
    const r = parse('明天 下午 3 点 交报告')
    expect(r.day).toBe(addDays(TODAY, 1))
    expect(r.clean).toBe('下午 3 点 交报告')
  })
})

describe('parseLedgerCapture：「账 25 午饭」格式', () => {
  it('金额 + 备注', () => {
    expect(parseLedgerCapture('账 25 午饭')).toEqual({ amount: 25, note: '午饭' })
    expect(parseLedgerCapture('账 12.5 奶茶')).toEqual({ amount: 12.5, note: '奶茶' })
  })
  it('备注可省略', () => {
    expect(parseLedgerCapture('账 30')).toEqual({ amount: 30, note: '随手记的一笔' })
  })
  it('非记账格式返回 null', () => {
    expect(parseLedgerCapture('明天交报告')).toBeNull()
    expect(parseLedgerCapture('账 午饭')).toBeNull()
    expect(parseLedgerCapture('账 0 午饭')).toBeNull()
    expect(parseLedgerCapture('')).toBeNull()
  })
})
