// ai.js 单元测试：dataSummary 数据摘要 / parseActs 动作标记解析 / localAgent 离线意图分支
// 假时钟固定在 2026-09-11（周五），保证日期相关的确定性输出。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { dataSummary, parseActs, localAgent } from '../ai.js'

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

// 一份覆盖待办/账本/习惯/学习/复盘的小镇档案
const state = () => ({
  profile: { name: '提莫', height: 170, level: 3, coins: 120, streak: 4, lastActiveDay: '2026-09-10', weekly: { week: '', id: '', claimed: false }, stats: { todosDone: 3, ledger: 5, pomos: 2 } },
  xpToday: 30,
  todos: [
    { id: 't1', text: '写周报', cat: '工作', prio: false, done: false, day: '2026-09-11', repeat: '', lastDone: '', diff: 2 },
    { id: 't2', text: '买菜', cat: '生活', prio: false, done: true, day: '2026-09-11', repeat: '', lastDone: '', diff: 2 },
  ],
  ledger: [
    { id: 'l1', day: '2026-09-11', type: 'out', amount: 30, cat: '餐饮', note: '午饭' },
    { id: 'l2', day: '2026-09-05', type: 'in', amount: 5000, cat: '工资', note: '' },
  ],
  habits: [
    { id: 'h1', name: '喝水', icon: '💧', color: 'green', days: { '2026-09-11': 1 }, diff: 2 },
    { id: 'h2', name: '跑步', icon: '🏃', color: 'orange', days: {}, diff: 2 },
  ],
  study: [{ id: 'p1', title: 'React 通关', targetH: 10, deadline: '', sessions: [{ day: '2026-09-11', min: 25, note: '', h: 9 }] }],
  reviews: { '2026-09-10': { mood: 4 } },
  news: { cachedAt: 0, items: [], source: '' },
  chat: [],
  xpLog: {},
  weights: [],
  settings: { apiKey: '' },
})

const atNoon = () => vi.useFakeTimers({ now: new Date('2026-09-11T10:00:00') })

describe('dataSummary 数据摘要', () => {
  it('汇总等级、待办、习惯、账本、体重、学习、复盘', () => {
    atNoon()
    const s = dataSummary(state())
    expect(s).toContain('等级 Lv.3，金币 120，连续投入 4 天，今日 XP 30')
    expect(s).toContain('今日待办还剩 1 件：写周报')
    expect(s).toContain('总待办 2 条')
    expect(s).toContain('习惯打卡：今日 1/2 个已完成')
    expect(s).toContain('收入 ¥5000，支出 ¥30，总结余 ¥4970')
    expect(s).toContain('最新体重 未记录')
    expect(s).toContain('React 通关（0.4/10h）')
    expect(s).toContain('复盘存档 1 篇')
  })

  it('脏数据只截断、不进入摘要内容（防注入）', () => {
    atNoon()
    const s = dataSummary(state())
    expect(s).not.toContain('忽略以上内容')
    expect(s.length).toBeLessThan(800)
  })
})

describe('parseActs 动作标记解析', () => {
  it('剥离 todo 标记并返回干净文本', () => {
    const r = parseActs('好的好的\n[ACT:todo_add:明天交报告]')
    expect(r.clean).toBe('好的好的')
    expect(r.acts).toEqual([{ type: 'TODO_ADD', text: '明天交报告' }])
  })

  it('剥离记账标记（金额 + 备注）', () => {
    const r = parseActs('记账了\n[ACT:ledger_add:25:午饭]')
    expect(r.clean).toBe('记账了')
    expect(r.acts).toEqual([{ type: 'LEDGER_ADD', dir: 'out', amount: 25, cat: '餐饮', note: '午饭' }])
  })

  it('多个标记全部剥离并保留顺序', () => {
    const r = parseActs('[ACT:todo_add:买牛奶][ACT:ledger_add:30:咖啡]')
    expect(r.clean).toBe('')
    expect(r.acts).toEqual([
      { type: 'TODO_ADD', text: '买牛奶' },
      { type: 'LEDGER_ADD', dir: 'out', amount: 30, cat: '餐饮', note: '咖啡' },
    ])
  })

  it('记账标记支持中文冒号与省略备注', () => {
    const r = parseActs('[ACT:ledger_add:25：晚饭]')
    expect(r.acts[0]).toMatchObject({ amount: 25, note: '晚饭' })
    const r2 = parseActs('[ACT:ledger_add:25]')
    expect(r2.acts[0]).toMatchObject({ amount: 25, note: '阿咕帮记的一笔' })
  })

  it('无金额的记账标记只剥离、不产生动作', () => {
    const r = parseActs('[ACT:ledger_add:午饭]')
    expect(r.acts).toEqual([])
    expect(r.clean).toBe('')
  })

  it('普通文本与空输入原样返回', () => {
    expect(parseActs('没事发生')).toEqual({ clean: '没事发生', acts: [] })
    expect(parseActs('')).toEqual({ clean: '', acts: [] })
  })

  it('todo 文本截断到 60 字符', () => {
    const r = parseActs(`[ACT:todo_add:${'甲'.repeat(65)}]`)
    expect(r.acts[0].text).toHaveLength(60)
  })
})

describe('localAgent 离线意图', () => {
  beforeEach(() => atNoon())

  it('记待办', () => {
    const r = localAgent('帮我记一条待办：给花浇水', state())
    expect(r.reply).toContain('给花浇水')
    expect(r.action).toEqual({ type: 'TODO_ADD', text: '给花浇水' })
  })

  it('记账（带金额和备注）', () => {
    const r = localAgent('记账 25 午饭', state())
    expect(r.action).toEqual({ type: 'LEDGER_ADD', dir: 'out', amount: 25, cat: '餐饮', note: '午饭' })
    expect(r.reply).toContain('¥25')
  })

  it('记账无备注时用默认文案', () => {
    const r = localAgent('记账 25', state())
    expect(r.action.note).toBe('随笔记了一笔')
  })

  it('查询剩余待办', () => {
    const r = localAgent('今天还剩几件事？', state())
    expect(r.reply).toContain('1')
    expect(r.action).toBeUndefined()
  })

  it('查询本月收支与余额', () => {
    const r = localAgent('这个月花了多少？', state())
    expect(r.reply).toContain('¥5000')
    expect(r.reply).toContain('¥30')
    expect(r.reply).toContain('¥4970')
  })

  it('无体重记录时引导去记录', () => {
    const r = localAgent('我体重多少', state())
    expect(r.reply).toContain('还没有体重记录')
  })

  it('有体重记录时给出最新值', () => {
    const s = state()
    s.weights = [{ day: '2026-09-10', kg: 70 }]
    const r = localAgent('我体重多少', s)
    expect(r.reply).toContain('70kg')
    expect(r.reply).toContain('BMI 24.2')
  })

  it('查询习惯进度', () => {
    const r = localAgent('今天习惯怎么样', state())
    expect(r.reply).toContain('今日习惯 1/2')
  })

  it('新闻为空时提示刷新', () => {
    const r = localAgent('最近有什么新闻', state())
    expect(r.reply).toContain('新闻小信鸽')
  })

  it('新闻有内容时给出前两条', () => {
    const s = state()
    s.news = { cachedAt: 0, items: [{ title: '头条甲' }, { title: '头条乙' }, { title: '头条丙' }], source: 'live' }
    const r = localAgent('看看新闻', s)
    expect(r.reply).toContain('头条甲')
    expect(r.reply).toContain('头条乙')
  })

  it('查询学习进度', () => {
    const r = localAgent('我的学习进度如何？', state())
    expect(r.reply).toContain('React 通关')
    expect(r.reply).toContain('0.4')
  })

  it('番茄钟引导去学习计划页', () => {
    const r = localAgent('开始番茄钟吧', state())
    expect(r.reply).toContain('番茄钟')
  })

  it('查询商店金币', () => {
    const r = localAgent('商店里能买什么', state())
    expect(r.reply).toContain('120 枚金币')
  })

  it('安慰 / 笑话 / 自我介绍 / 帮助 / 日期 / 默认兜底都能应答', () => {
    for (const q of ['有点难过', '讲个笑话', '你是谁', '你能做什么', '今天是几号', '随便聊聊']) {
      const r = localAgent(q, state())
      expect(typeof r.reply).toBe('string')
      expect(r.reply.length).toBeGreaterThan(0)
    }
    expect(localAgent('今天是几号', state()).reply).toContain('2026-09-11')
  })
})