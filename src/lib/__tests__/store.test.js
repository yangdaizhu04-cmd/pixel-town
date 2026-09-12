// 存档迁移 / reducer / 游戏化数值 的单元测试（vitest + jsdom）
import { describe, it, expect, vi } from 'vitest'
import { hydrate, reducer, seed } from '../store.jsx'
import { rewardBy, rollChest, xpNeeded, REWARDS } from '../gamify.js'
import { dayKey, addDays } from '../dates.js'
import { backupPayload } from '../webdav.js'

describe('hydrate：v1 旧档迁移', () => {
  const v1 = {
    v: 1, // 真实 v1 存档自带版本号；迁移成功靠它 < 2
    profile: {
      name: '镇长',
      height: 170,
      level: 2,
      xp: 10,
      coins: 5,
      streak: 1,
      lastActiveDay: '2026-09-06',
      waterTotal: 1,
      waterLastDay: '2026-09-06',
      pots: [{ id: 'sunflower', pts: 3 }, { id: 'berry', pts: 1 }],
      stats: { todosDone: 3 },
    },
    todos: [{ id: 'a', text: '老任务', cat: '工作', prio: false, done: true, day: '2026-09-07' }],
    habits: [{ id: 'h', name: '喝水', icon: '💧', color: 'blue', days: {} }],
    english: { queue: ['apple', 'book'], known: [], right: 2, wrong: 1, custom: [] },
  }

  it('pots 从「品种即 id」迁移成 { id, kind }', () => {
    const s = hydrate(v1)
    expect(s.v).toBe(2)
    expect(s.profile.pots[0].kind).toBe('sunflower')
    expect(s.profile.pots[0].pts).toBe(3)
    expect(s.profile.pots[0].id).toBeTruthy()
  })

  it('英文生词本 string 数组升级为 { w, due, interval }', () => {
    const s = hydrate(v1)
    expect(s.english.queue[0]).toEqual({ w: 'apple', due: expect.any(String), interval: 0 })
  })

  it('旧档待办/习惯默认「普通」难度 + 新字段兜底', () => {
    const s = hydrate(v1)
    expect(s.todos[0].diff).toBe(2)
    expect(s.todos[0].repeat).toBe('')
    expect(s.todos[0].lastDone).toBe('')
    expect(s.habits[0].diff).toBe(2)
    expect(s.profile.customAch).toEqual([])
    expect(s.profile.rewards).toEqual([])
    expect(s.profile.rewardsOwned).toEqual([])
    expect(s.profile.lastAutoBackupDay).toBe('')
    expect(s.settings.autoBackup).toBe(false)
  })
})

describe('reducer：待办', () => {
  const today = dayKey()

  it('TODO_ADD 默认难度 2，可指定难度', () => {
    const base = seed()
    const r1 = reducer(base, { type: 'TODO_ADD', text: '写测试' })
    expect(r1.todos[0].diff).toBe(2)
    const r2 = reducer(base, { type: 'TODO_ADD', text: '重活', diff: 3 })
    expect(r2.todos[0].diff).toBe(3)
  })

  it('完成逾期待办把 day 挪到今天，不再凭空消失（全面检查抓过的 bug）', () => {
    const base = {
      ...seed(),
      todos: [{ id: 'x1', text: '旧任务', cat: '生活', prio: false, done: false, day: addDays(today, -6), repeat: '', lastDone: '', diff: 2 }],
    }
    const before = base.profile.stats.todosDone
    const r = reducer(base, { type: 'TODO_TOGGLE', id: 'x1' })
    expect(r.todos[0].done).toBe(true)
    expect(r.todos[0].day).toBe(today)
    expect(r.profile.stats.todosDone).toBe(before + 1)
  })
})

describe('reducer：自定义成就与愿望货架', () => {
  it('ACH_CUSTOM_ADD → ACH_UNLOCK 只发一次金币 → ACH_CUSTOM_DEL 连解锁记录一起清', () => {
    let s = seed()
    s = reducer(s, { type: 'ACH_CUSTOM_ADD', meta: { name: '读完十本书', metric: 'todosDone', target: 10, coins: 5 } })
    expect(s.profile.customAch).toHaveLength(1)
    const id = s.profile.customAch[0].id
    expect(id.startsWith('c-')).toBe(true)
    const baseCoins = s.profile.coins
    s = reducer(s, { type: 'ACH_UNLOCK', id, coins: 5 })
    expect(s.profile.achievements[id]).toBeTruthy()
    expect(s.profile.coins).toBe(baseCoins + 5)
    s = reducer(s, { type: 'ACH_UNLOCK', id, coins: 5 })
    expect(s.profile.coins).toBe(baseCoins + 5) // 重复解锁不再给钱
    s = reducer(s, { type: 'ACH_CUSTOM_DEL', id })
    expect(s.profile.customAch).toHaveLength(0)
    expect(s.profile.achievements[id]).toBeUndefined()
  })

  it('REWARD_ADD → SHOP_BUY 只能买一次 → REWARD_REDEEM / REWARD_DEL', () => {
    // 空白开局钱包为 0，先准备金币再测试购买
    let s = reducer(seed(), { type: 'PROFILE_SET', patch: { coins: 100 } })
    s = reducer(s, { type: 'REWARD_ADD', name: '看一场电影', cost: 20 })
    const id = s.profile.rewards[0].id
    const base = s.profile.coins
    s = reducer(s, { type: 'SHOP_BUY', goods: 'reward', id, cost: 20 })
    expect(s.profile.coins).toBe(base - 20)
    expect(s.profile.rewardsOwned).toContain(id)
    s = reducer(s, { type: 'SHOP_BUY', goods: 'reward', id, cost: 20 })
    expect(s.profile.coins).toBe(base - 20) // 防重复扣钱
    s = reducer(s, { type: 'REWARD_REDEEM', id })
    expect(s.profile.rewardsDone).toContain(id)
    s = reducer(s, { type: 'REWARD_DEL', id })
    expect(s.profile.rewards).toHaveLength(0)
    expect(s.profile.rewardsOwned).not.toContain(id)
  })
})

describe('reducer：GRANT 升级与连续', () => {
  it('XP 溢出触发升级、断签重置连续', () => {
    const base = { ...seed(), profile: { ...seed().profile, xp: xpNeeded(3) - 1, level: 3 } }
    const r = reducer(base, { type: 'GRANT', xp: 5, coins: 0 })
    expect(r.profile.level).toBe(4)
    expect(r.profile.xp).toBe(4) // 139+5-140
    expect(r.profile.streak).toBe(base.profile.streak + 1) // 昨天来过 → 连续 +1
    const oops = { ...base, profile: { ...base.profile, lastActiveDay: addDays(dayKey(), -3) } }
    const r2 = reducer(oops, { type: 'GRANT', xp: 1, coins: 0 })
    expect(r2.profile.streak).toBe(1) // 断签 3 天 → 重置为 1
  })
})

describe('reducer：WATER 按盆浇水', () => {
  const growerState = () => ({
    ...seed(),
    profile: {
      ...seed().profile,
      coins: 100,
      waterLastDay: dayKey(), // 今天已免费浇过 → 本次收费，避免免费逻辑干扰
      pots: [
        { id: 'p1', kind: 'sunflower', pts: 1 },
        { id: 'p2', kind: 'tulip', pts: 4 },
      ],
    },
  })

  it('指定 potId 只浇那一盆，其他盆不涨', () => {
    const r = reducer(growerState(), { type: 'WATER', cost: 2, potId: 'p2' })
    expect(r.profile.pots.find((x) => x.id === 'p1').pts).toBe(1)
    expect(r.profile.pots.find((x) => x.id === 'p2').pts).toBe(5)
    expect(r.justGrew).toBe('p2')
    expect(r.profile.coins).toBe(98)
  })

  it('不传 potId 自动浇最缺水的一盆', () => {
    const r = reducer(growerState(), { type: 'WATER', cost: 0 })
    expect(r.profile.pots.find((x) => x.id === 'p1').pts).toBe(2)
    expect(r.profile.pots.find((x) => x.id === 'p2').pts).toBe(4)
    expect(r.justGrew).toBe('p1')
  })

  it('已盛开的盆不会被打湿，waterTotal 与扣费仍正常', () => {
    const base = {
      ...growerState(),
      profile: {
        ...growerState().profile,
        pots: [
          { id: 'p1', kind: 'sunflower', pts: 14 }, // 已盛开
          { id: 'p2', kind: 'tulip', pts: 14 },     // 已盛开
        ],
      },
    }
    const r = reducer(base, { type: 'WATER', cost: 2, potId: 'p1' })
    expect(r.profile.pots.find((x) => x.id === 'p1').pts).toBe(14) // 不开花不涨
    expect(r.justGrew).toBe(null)
    expect(r.profile.waterTotal).toBe(base.profile.waterTotal + 1)
    expect(r.profile.coins).toBe(98)
  })
})

describe('跨天修正：今天的进度只属于今天', () => {
  it('hydrate 遇到 xpTodayDay 是昨天 → 今日 XP 归零并翻到今天（全面检查抓过的 bug）', () => {
    const old = { ...seed(), xpToday: 99, xpTodayDay: addDays(dayKey(), -1) }
    const s = hydrate(JSON.parse(JSON.stringify(old)))
    expect(s.xpToday).toBe(0)
    expect(s.xpTodayDay).toBe(dayKey())
  })

  it('hydrate 当日数据不误清零', () => {
    const t = dayKey()
    const same = hydrate({ ...seed(), xpToday: 55, xpTodayDay: t })
    expect(same.xpToday).toBe(55)
    expect(same.xpTodayDay).toBe(t)
  })
})

describe('IMPORT：恢复备份不清空已配密钥', () => {
  it('备份（backupPayload 已剥密钥）导入后，apiKey/webdavPass 保留当前配置', () => {
    // 值随意（不是真密钥，join 拼接生成），只验证「导入后保留当前配置」这一行为
    const curKey = ['fixture', 'keep', 'current', 'key'].join('-')
    const curPass = ['fixture', 'keep', 'current', 'pass'].join('-')
    const cur = {
      ...seed(),
      settings: { ...seed().settings, apiKey: curKey, webdavPass: curPass, webdavUrl: 'https://dav.example/dav/' },
    }
    const backup = backupPayload(cur) // apiKey / webdavPass 已被剥空
    const r = reducer(cur, { type: 'IMPORT', state: backup })
    expect(r.settings.apiKey).toBe(curKey)
    expect(r.settings.webdavPass).toBe(curPass)
  })
})

describe('reducer：番茄专注墙 + 周挑战', () => {
  it('POMO_DONE 记录一条专注墙条目，超过 200 条自动裁剪', () => {
    let s = seed()
    s = reducer(s, { type: 'POMO_DONE', min: 25, planId: '', h: 21 })
    expect(s.pomoLog).toHaveLength(1)
    expect(s.pomoLog[0]).toMatchObject({ min: 25, h: 21, planId: '' })
    for (let i = 0; i < 205; i++) s = reducer(s, { type: 'POMO_DONE', min: 25, planId: '', h: 10 })
    expect(s.pomoLog.length).toBeLessThanOrEqual(200)
  })

  it('hydrate 踢掉结构脏的 pomoLog 条目与生词本 null 条目', () => {
    const dirty = {
      ...seed(),
      pomoLog: [null, { t: 'x' }, { t: '2026-09-07', min: 25 }],
      english: { ...seed().english, queue: [null, 'plain', { w: '', interval: 1 }, { w: 'ok', interval: 2, due: '2026-09-07' }] },
    }
    const s = hydrate(JSON.parse(JSON.stringify(dirty)))
    expect(s.pomoLog).toEqual([{ t: '2026-09-07', min: 25 }])
    expect(s.english.queue).toEqual([{ w: 'ok', interval: 2, due: '2026-09-07' }])
  })

  it('CHALLENGE_CLAIM 发金币并标记本周已领，重复领取不再给钱', () => {
    let s = seed()
    s = reducer(s, { type: 'CHALLENGE_CLAIM', coins: 10 })
    expect(s.profile.weekly.claimed).toBe(true)
    expect(s.profile.coins).toBe(seed().profile.coins + 10)
    const before = s.profile.coins
    s = reducer(s, { type: 'CHALLENGE_CLAIM', coins: 10 })
    expect(s.profile.coins).toBe(before)
  })

  it('旧档没有 weekly / pomoLog 也能 hydrate 兜底', () => {
    const old = { ...seed(), profile: { ...seed().profile, weekly: undefined } }
    delete old.pomoLog
    const s = hydrate(old)
    expect(s.profile.weekly).toEqual({ week: '', id: '', claimed: false })
    expect(s.pomoLog).toEqual([])
  })
})

describe('webdav：备份内容剥离密钥', () => {
  it('backupPayload 剥掉 apiKey 与 webdavPass，保留其余数据', () => {
    const base = seed()
    const s = {
      ...base,
      // 值随意（不是真密钥，join 拼接生成），backupPayload 只要把它们剥空就对
      settings: { ...base.settings, apiKey: ['fixture', 'xyz'].join('-'), webdavPass: ['fixture', 'hidden'].join('-'), webdavUrl: 'https://dav/jianguoyun.com/dav/' },
    }
    const out = backupPayload(s)
    expect(out.settings.apiKey).toBe('')
    expect(out.settings.webdavPass).toBe('')
    expect(out.settings.webdavUrl).toBe('https://dav/jianguoyun.com/dav/')
    expect(out.profile).toEqual(s.profile)
  })
})

describe('gamify：难度/盲盒/升级曲线', () => {
  it('rewardBy 按难度缩放（简单 ×0.6 / 普通 ×1 / 困难 ×1.6）', () => {
    const base = REWARDS.todo // 10 XP / 5 金币
    expect(rewardBy(base, 1)).toEqual({ xp: 6, coins: 3 })
    expect(rewardBy(base, 2)).toEqual({ xp: 10, coins: 5 })
    expect(rewardBy(base, 3)).toEqual({ xp: 16, coins: 8 })
  })

  it('rollChest 金额在 ±30% 区间且保底 4 金币；小概率触发惊喜', () => {
    const spy = vi.spyOn(Math, 'random')
    spy.mockReturnValue(0) // 两项都取最小 → 金额 = round(25*0.7)=18，0<0.08 → 触发惊喜
    const { coins, bonus } = rollChest(25)
    expect(coins).toBe(18)
    expect(bonus).toBe(true)
    spy.mockReturnValue(0.5) // 0.5<0.08 false → 无惊喜，金额 round(25*1.0)=25
    const r2 = rollChest(25)
    expect(r2.coins).toBe(25)
    expect(r2.bonus).toBe(false)
    spy.mockRestore()
  })

  it('升级曲线 xpNeeded 递增', () => {
    expect(xpNeeded(1)).toBe(60)
    expect(xpNeeded(2)).toBe(100)
    expect(xpNeeded(3)).toBe(140)
  })
})

describe('v0.7.0：记录级 updatedAt / 回收站 / 月度目标', () => {
  const today = dayKey()

  it('TODO_ADD / LEDGER_ADD 盖上 updatedAt（同步合并的依据）', () => {
    let s = seed()
    s = reducer(s, { type: 'TODO_ADD', text: 'x' })
    expect(s.todos[0].updatedAt).toBeGreaterThan(0)
    s = reducer(s, { type: 'LEDGER_ADD', dir: 'out', amount: 10, cat: '餐饮' })
    expect(s.ledger[0].updatedAt).toBeGreaterThan(0)
  })

  it('reducer 外壳把被触碰的切片记进 _touched（KV 同步用），没碰的不记', () => {
    let s = seed()
    s = reducer(s, { type: 'TODO_ADD', text: 'x' })
    expect(s._touched.todos).toBeGreaterThan(0)
    expect(s._touched.profile).toBeUndefined()
    s = reducer(s, { type: 'GRANT', xp: 5, coins: 1 })
    expect(s._touched.profile).toBeGreaterThan(0)
  })

  it('TODO_DEL 移入回收站（软删除），TRASH_RESTORE 放回且墓碑保留恢复标记', () => {
    let s = seed()
    s = reducer(s, { type: 'TODO_ADD', text: '误删的' })
    const id = s.todos[0].id
    s = reducer(s, { type: 'TODO_DEL', id })
    expect(s.todos).toHaveLength(0)
    expect(s.trash).toHaveLength(1)
    expect(s.trash[0]).toMatchObject({ kind: 'todo', refId: id, restoredAt: 0 })
    s = reducer(s, { type: 'TRASH_RESTORE', id: s.trash[0].id })
    expect(s.todos).toHaveLength(1)
    expect(s.todos[0].id).toBe(id)
    expect(s.trash[0].restoredAt).toBeGreaterThan(0)
  })

  it('TRASH_RESTORE 幂等：已恢复的条目再恢复一次不变', () => {
    let s = seed()
    s = reducer(s, { type: 'TODO_ADD', text: 'a' })
    s = reducer(s, { type: 'TODO_DEL', id: s.todos[0].id })
    s = reducer(s, { type: 'TRASH_RESTORE', id: s.trash[0].id })
    const once = s
    s = reducer(s, { type: 'TRASH_RESTORE', id: s.trash[0].id })
    expect(s).toBe(once)
  })

  it('TODO_CLEAR_ALL_DONE 批量入回收站', () => {
    let s = seed()
    s = reducer(s, { type: 'TODO_ADD', text: 'a' })
    s = reducer(s, { type: 'TODO_ADD', text: 'b' })
    s = reducer(s, { type: 'TODO_TOGGLE', id: s.todos[0].id })
    s = reducer(s, { type: 'TODO_TOGGLE', id: s.todos[1].id })
    s = reducer(s, { type: 'TODO_CLEAR_ALL_DONE' })
    expect(s.todos).toHaveLength(0)
    expect(s.trash).toHaveLength(2)
  })

  it('账单 / 习惯 / 学习计划 / 体重删除都先进回收站；体重墓碑 refId 是 day', () => {
    let s = seed()
    s = reducer(s, { type: 'LEDGER_ADD', dir: 'out', amount: 5, cat: '餐饮' })
    s = reducer(s, { type: 'LEDGER_DEL', id: s.ledger[0].id })
    s = reducer(s, { type: 'HABIT_ADD', name: '喝水', icon: '💧' })
    s = reducer(s, { type: 'HABIT_DEL', id: s.habits[0].id })
    s = reducer(s, { type: 'STUDY_ADD', title: 'React' })
    s = reducer(s, { type: 'STUDY_DEL', id: s.study[0].id })
    s = reducer(s, { type: 'WEIGHT_ADD', day: today, kg: 65 })
    s = reducer(s, { type: 'WEIGHT_DEL', day: today })
    expect(s.trash.map((x) => x.kind).sort()).toEqual(['habit', 'ledger', 'study', 'weight'])
    expect(s.trash.find((x) => x.kind === 'weight').refId).toBe(today)
  })

  it('TRASH_PURGE / TRASH_EMPTY 彻底清除', () => {
    let s = seed()
    s = reducer(s, { type: 'TODO_ADD', text: 'a' })
    s = reducer(s, { type: 'TODO_DEL', id: s.todos[0].id })
    s = reducer(s, { type: 'TODO_ADD', text: 'b' })
    s = reducer(s, { type: 'TODO_DEL', id: s.todos[0].id })
    s = reducer(s, { type: 'TRASH_PURGE', id: s.trash[0].id })
    expect(s.trash).toHaveLength(1)
    s = reducer(s, { type: 'TRASH_EMPTY' })
    expect(s.trash).toHaveLength(0)
  })

  it('hydrate：超期（30 天前）的回收站条目自动清理，新的保留', () => {
    const s = hydrate({
      profile: { name: 'x' },
      trash: [
        { id: 't-old', kind: 'todo', refId: 'a', data: { id: 'a' }, deletedAt: Date.now() - 31 * 86400000, updatedAt: Date.now() - 31 * 86400000 },
        { id: 't-new', kind: 'todo', refId: 'b', data: { id: 'b' }, deletedAt: Date.now() - 3 * 86400000, updatedAt: Date.now() - 3 * 86400000 },
      ],
    })
    expect(s.trash.map((x) => x.id)).toEqual(['t-new'])
  })

  it('hydrate：旧档 weights 补 id=day、各切片补 updatedAt=0', () => {
    const s = hydrate({
      profile: { name: 'x' },
      todos: [{ id: 'a', text: '老待办' }],
      weights: [{ day: '2026-09-09', kg: 60 }],
      reviews: { '2026-09-09': { mood: 1 } },
    })
    expect(s.todos[0].updatedAt).toBe(0)
    expect(s.weights[0]).toMatchObject({ id: '2026-09-09', updatedAt: 0 })
    expect(s.reviews['2026-09-09'].updatedAt).toBe(0)
  })

  it('GOAL_ADD / GOAL_TOGGLE / GOAL_DEL：目标带月份与时间戳，删除进回收站', () => {
    let s = seed()
    s = reducer(s, { type: 'GOAL_ADD', text: '读完第一章' })
    const g = s.goals[0]
    expect(g).toMatchObject({ text: '读完第一章', month: today.slice(0, 7), done: false })
    s = reducer(s, { type: 'GOAL_TOGGLE', id: g.id })
    expect(s.goals[0].done).toBe(true)
    expect(s.goals[0].doneAt).toBeGreaterThan(0)
    s = reducer(s, { type: 'GOAL_TOGGLE', id: g.id })
    expect(s.goals[0].done).toBe(false)
    s = reducer(s, { type: 'GOAL_DEL', id: g.id })
    expect(s.goals).toHaveLength(0)
    expect(s.trash[0]).toMatchObject({ kind: 'goal', refId: g.id })
  })

  it('REVIEW_SAVE 存下 ask（每日一问的答案）并盖时间戳', () => {
    let s = seed()
    s = reducer(s, { type: 'REVIEW_SAVE', day: today, mood: 2, good: '', thanks: '', tomorrow: '', ask: '喝够水了' })
    expect(s.reviews[today]).toMatchObject({ ask: '喝够水了', updatedAt: expect.any(Number) })
  })
})