import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react'
import { dayKey, addDays, monthKey, daysBetween } from './dates.js'
import { xpNeeded } from './gamify.js'
import { WORDS } from './words.js'

// ---------- 植物生长 ----------
export const STAGE_PTS = [0, 2, 5, 9, 14]
export const BLOOM_PTS = STAGE_PTS[4]
export const STAGE_NAMES = ['种子', '发芽', '幼苗', '花苞', '盛开']
export const stageOf = (pts) => {
  let s = 0
  STAGE_PTS.forEach((t, i) => { if (pts >= t) s = i })
  return s
}

const LS_KEY = 'pixel-town-save-v1'
const uid = () => Math.random().toString(36).slice(2, 9)

// ---------- 种子数据（首次打开就是一座有生活气的小镇） ----------
export function seed() {
  const t = dayKey()
  const d = (n) => addDays(t, -n)
  // 演示用历史 XP：过去 24 天有起有伏，让热力图第一眼就有「生活感」
  const xpLog = {}
  const pattern = [40, 66, 0, 125, 88, 30, 52, 0, 95, 130, 45, 10, 70, 25, 0, 110, 60, 35, 85, 15, 55, 100, 20, 75]
  pattern.forEach((v, i) => { xpLog[d(pattern.length - i)] = v })
  return {
    v: 2,
    profile: {
      name: '小镇居民',
      height: 170,
      level: 3,
      xp: 35,
      coins: 128,
      streak: 4,
      lastActiveDay: d(1),
      waterTotal: 23,
      waterLastDay: d(2),
      // v2 花盆：id 只是盆位，kind 才是植物品种；kind 为空 = 空盆
      pots: [
        { id: 'pot-1', kind: 'sunflower', pts: 10 },
        { id: 'pot-2', kind: 'tulip', pts: 6 },
        { id: 'pot-3', kind: 'berry', pts: 2 },
      ],
      unlockedKinds: ['sunflower', 'tulip', 'berry'],
      collection: ['sunflower'],
      decor: ['fence'],
      hat: '',
      achievements: {},
      customAch: [],
      rewards: [],
      rewardsOwned: [],
      rewardsDone: [],
      weightGoal: null,
      lastExportDay: '',
      stats: { todosDone: 12, ledger: 12, pomos: 0 },
    },
    xpLog,
    xpToday: 55,
    xpTodayDay: t,
    claimed: { [t]: [] },
    budgets: {},
    todos: [
      { id: uid(), text: '给小镇写一封本周小结', cat: '工作', prio: true, done: false, day: t, repeat: '' },
      { id: uid(), text: '伸展 5 分钟，看看窗外的云', cat: '生活', prio: false, done: false, day: t, repeat: '', diff: 1 },
      { id: uid(), text: '把明天要用的资料打印好', cat: '工作', prio: false, done: false, day: addDays(t, 1), repeat: '' },
      { id: uid(), text: '读完《深度工作》第 3 章', cat: '学习', prio: false, done: true, day: t, repeat: '', diff: 3 },
      { id: uid(), text: '回复合作邮件', cat: '工作', prio: false, done: true, day: d(1), repeat: '' },
      { id: uid(), text: '睡前把明天的水杯装满', cat: '生活', prio: false, done: false, day: t, repeat: 'daily', lastDone: '' },
      { id: uid(), text: '给阿咕的小花园拍张照', cat: '生活', prio: false, done: false, day: t, repeat: 'weekly', lastDone: '' },
    ],
    ledger: [
      { id: uid(), day: t, type: 'out', amount: 25, cat: '餐饮', note: '晚饭·食堂' },
      { id: uid(), day: d(1), type: 'out', amount: 199, cat: '学习', note: '网课季度卡' },
      { id: uid(), day: d(1), type: 'out', amount: 18, cat: '餐饮', note: '咖啡' },
      { id: uid(), day: d(2), type: 'in', amount: 60, cat: '其他', note: '卖闲置书' },
      { id: uid(), day: d(2), type: 'out', amount: 45, cat: '娱乐', note: '电影票' },
      { id: uid(), day: d(3), type: 'out', amount: 45, cat: '购物', note: '新的马克笔' },
      { id: uid(), day: d(4), type: 'out', amount: 38, cat: '餐饮', note: '和朋友吃拉面' },
      { id: uid(), day: d(4), type: 'out', amount: 50, cat: '交通', note: '地铁卡充值' },
      { id: uid(), day: d(5), type: 'out', amount: 9, cat: '餐饮', note: '早餐煎饼' },
      { id: uid(), day: d(5), type: 'in', amount: 8500, cat: '工资', note: '工资到账' },
      { id: uid(), day: d(7), type: 'out', amount: 76, cat: '生活', note: '水电费' },
      { id: uid(), day: d(9), type: 'out', amount: 120, cat: '娱乐', note: '桌游一局' },
    ],
    habits: [
      { id: uid(), name: '喝够 8 杯水', icon: '💧', color: 'blue', days: { [d(4)]: 1, [d(3)]: 1, [d(2)]: 1, [d(1)]: 1, [t]: 1 }, diff: 1 },
      { id: uid(), name: '拉伸 10 分钟', icon: '🧘', color: 'pink', days: { [d(3)]: 1, [d(2)]: 1, [t]: 1 } },
      { id: uid(), name: '23:30 前睡觉', icon: '🛏️', color: 'orange', days: { [d(2)]: 1, [d(1)]: 1 }, diff: 3 },
      { id: uid(), name: '读 20 页书', icon: '📖', color: 'green', days: { [d(1)]: 1 } },
    ],
    study: [
      {
        id: uid(), title: 'React 通关小课', targetH: 12, deadline: addDays(t, 20),
        sessions: [{ day: d(3), min: 60, note: 'Hooks 章节' }, { day: d(2), min: 45, note: '' }, { day: d(1), min: 90, note: '练习项目' }, { day: t, min: 75, note: '状态管理' }],
      },
      {
        id: uid(), title: '英语听力磨耳朵', targetH: 8, deadline: addDays(t, 35),
        sessions: [{ day: d(4), min: 30, note: '' }, { day: d(2), min: 45, note: '播客' }, { day: d(1), min: 75, note: '' }],
      },
    ],
    // v2 生词本：queue 从 string 升级为 { w, due, interval }（简化间隔重复）
    english: { known: [], queue: [], right: 0, wrong: 0, custom: [] },
    weights: [64.2, 64.1, 64.3, 64.0, 63.9, 64.0, 63.8, 63.9, 63.7, 63.6, 63.7, 63.5, 63.6, 63.4, 63.3]
      .map((kg, i) => ({ day: d(14 - i), kg })),
    reviews: {
      [d(1)]: { mood: 1, good: '把房间彻底收拾了一遍，书桌终于能摊开了。', thanks: '同事帮我带了咖啡。', tomorrow: '早上先做最重要的一件事。' },
      [d(2)]: { mood: 0, good: '跑了 3 公里，虽然慢但完成了。', thanks: '晚上地铁有座位。', tomorrow: '早点睡。' },
    },
    news: { cachedAt: 0, items: [], source: '' },
    chat: [
      { role: 'assistant', content: '咕咕！我是阿咕，小镇的管家精灵 🐣\n可以问我「今天还剩几件事」「这个月花了多少」，或者直接说「帮我记一条待办：明天交报告」～' },
    ],
    settings: {
      apiKey: '',
      baseUrl: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat',
      sound: true,
      notify: false,
      autoBackup: false,
      city: '',
      webdavUrl: '',
      webdavUser: '',
      webdavPass: '',
    },
  }
}

// ---------- 存档迁移（旧档 → 当前结构） ----------
// 规则：合并出完整对象后再逐版本升级；v 字段只增不减。
// 历史坑（见交接文档）：load() 曾只做浅合并，新字段在旧档里是 undefined 会导致页面崩。
export function hydrate(parsed) {
  const base = seed()
  if (!parsed || typeof parsed !== 'object' || !parsed.profile) return base
  let s = {
    ...base,
    ...parsed,
    profile: { ...base.profile, ...parsed.profile },
    settings: { ...base.settings, ...parsed.settings },
    english: { ...base.english, ...parsed.english },
  }
  const v = s.v || 1
  if (v < 2) {
    s = {
      ...s,
      v: 2,
      // v1 的 pots 里 id 就是品种名（sunflower/tulip/berry），v2 拆成 盆位 id + kind
      profile: {
        ...s.profile,
        pots: (s.profile.pots || []).map((x, i) => ({ id: x.id || `pot-${i + 1}`, kind: x.kind || x.id, pts: x.pts || 0 })),
        unlockedKinds: s.profile.unlockedKinds || ['sunflower', 'tulip', 'berry'],
        collection: s.profile.collection || [],
        decor: s.profile.decor || [],
        hat: s.profile.hat || '',
        achievements: s.profile.achievements || {},
        weightGoal: s.profile.weightGoal ?? null,
        lastExportDay: s.profile.lastExportDay || '',
        stats: s.profile.stats || { todosDone: 0, ledger: (s.ledger || []).length, pomos: 0 },
      },
      xpLog: s.xpLog || {},
      budgets: s.budgets || {},
      todos: (s.todos || []).map((x) => ({ ...x, repeat: x.repeat || '', lastDone: x.lastDone || '' })),
      english: {
        ...s.english,
        custom: s.english.custom || [],
        // v1 生词本是 string 数组，v2 是 { w, due, interval }
        queue: (s.english.queue || []).map((q) => (typeof q === 'string' ? { w: q, due: dayKey(), interval: 0 } : q)),
      },
    }
  }
  // 难度/重复字段兜底：旧档/未标的默认值（先展开再兜底，undefined 也被覆盖成默认）
  s.todos = (s.todos || []).map((x) => ({ ...x, diff: x.diff || 2, repeat: x.repeat || '', lastDone: x.lastDone || '' }))
  s.habits = (s.habits || []).map((x) => ({ ...x, diff: x.diff || 2 }))
  // 自定义成就 / 愿望货架的字段兜底（旧档没有就先用空数组）
  s.profile.customAch = s.profile.customAch || []
  s.profile.rewards = s.profile.rewards || []
  s.profile.rewardsOwned = s.profile.rewardsOwned || []
  s.profile.rewardsDone = s.profile.rewardsDone || []
  s.profile.lastAutoBackupDay = s.profile.lastAutoBackupDay || ''
  // 跨天修正：今日 XP / 礼箱按天重置。GRANT 分支也会重置，但「跨天首次打开页面、当天还没任何奖励动作」时，
  // 必须在这里就纠正——否则首页会把昨天的 XP 当成今天的展示（进度满但礼箱全可开，状态自相矛盾）。
  if (s.xpTodayDay !== dayKey()) {
    s.xpToday = 0
    s.xpTodayDay = dayKey()
  }
  return s
}

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return seed()
    return hydrate(JSON.parse(raw))
  } catch {
    return seed()
  }
}

// ---------- Reducer（纯函数：副作用一律走事件总线） ----------
export function reducer(s, a) {
  const t = dayKey()
  const P = { ...s.profile }
  switch (a.type) {
    case 'PROFILE_SET': return { ...s, profile: { ...P, ...a.patch } }
    case 'SETTINGS_SET': return { ...s, settings: { ...s.settings, ...a.patch } }

    case 'GRANT': {
      P.xp += a.xp || 0
      P.coins += a.coins || 0
      while (P.xp >= xpNeeded(P.level)) { P.xp -= xpNeeded(P.level); P.level += 1 }
      // 连续投入：有奖励的一天都算「来过小镇」
      if (P.lastActiveDay !== t) {
        P.streak = P.lastActiveDay === addDays(t, -1) ? P.streak + 1 : 1
        P.lastActiveDay = t
      }
      // 自动浇水：完成事情会让花园长一点；若因此盛开，顺手记进图鉴
      const pots = P.pots.map((x) => ({ ...x }))
      const target = [...pots].filter((x) => x.kind).sort((x, y) => x.pts - y.pts)[0]
      if (target && target.pts < BLOOM_PTS) {
        target.pts += 1
        if (target.pts >= BLOOM_PTS && !(P.collection || []).includes(target.kind)) {
          P.collection = [...(P.collection || []), target.kind]
        }
      }
      P.pots = pots
      P.waterTotal = (P.waterTotal || 0) + 1
      const xpLog = { ...(s.xpLog || {}), [t]: (s.xpLog?.[t] || 0) + (a.xp || 0) }
      const xpTodayDay = s.xpTodayDay === t ? s.xpTodayDay : t
      return { ...s, profile: P, xpLog, xpToday: s.xpTodayDay === t ? s.xpToday + (a.xp || 0) : (a.xp || 0), xpTodayDay }
    }

    case 'MILESTONE_CLAIM': {
      const list = s.claimed[t] || []
      if (list.includes(a.at)) return s
      P.coins += a.coins
      return { ...s, profile: P, claimed: { ...s.claimed, [t]: [...list, a.at] } }
    }
    // 盲盒惊喜的金币兜底（只用金币，不触发连续/浇水等完全体奖励）
    case 'CHEST_BONUS':
      return { ...s, profile: { ...P, coins: P.coins + (a.coins || 0) } }

    case 'WATER': {
      if ((a.cost || 0) > P.coins) return s
      const pots = P.pots.map((x) => ({ ...x }))
      // 指定 potId 只浇那一盆；否则自动挑最缺水（pts 最低）的一盆；已盛开的盆不再被浇
      const growers = pots.filter((x) => x.kind && x.pts < BLOOM_PTS)
      const target = a.potId ? growers.find((x) => x.id === a.potId) : growers.sort((x, y) => x.pts - y.pts)[0]
      if (target) {
        target.pts += 1
        if (target.pts >= BLOOM_PTS && !(P.collection || []).includes(target.kind)) {
          P.collection = [...(P.collection || []), target.kind]
        }
      }
      P.pots = pots
      P.waterTotal = (P.waterTotal || 0) + 1
      P.waterLastDay = t
      P.coins -= a.cost || 0
      return { ...s, profile: P, justGrew: target ? target.id : null }
    }

    // ---------- 商店 ----------
    case 'SHOP_BUY': {
      if (P.coins < a.cost) return s
      P.coins -= a.cost
      if (a.goods === 'pot') {
        const n = P.pots.length + 1
        P.pots = [...P.pots, { id: `pot-${n}-${uid().slice(0, 3)}`, kind: '', pts: 0 }]
      } else if (a.goods === 'seed') {
        P.unlockedKinds = [...(P.unlockedKinds || []), a.id]
      } else if (a.goods === 'decor') {
        P.decor = [...(P.decor || []), a.id]
      } else if (a.goods === 'hat') {
        P.hat = a.id
      } else if (a.goods === 'reward') {
        // 愿望奖励只能买一次
        if ((P.rewardsOwned || []).includes(a.id)) return s
        P.rewardsOwned = [...(P.rewardsOwned || []), a.id]
      }
      return { ...s, profile: P }
    }
    // 愿望货架：加一条自定义现实奖励
    case 'REWARD_ADD':
      return { ...s, profile: { ...P, rewards: [...(P.rewards || []), { id: uid(), name: a.name, cost: a.cost }] } }
    case 'REWARD_DEL':
      return {
        ...s,
        profile: {
          ...P,
          rewards: (P.rewards || []).filter((x) => x.id !== a.id),
          rewardsOwned: (P.rewardsOwned || []).filter((x) => x !== a.id),
          rewardsDone: (P.rewardsDone || []).filter((x) => x !== a.id),
        },
      }
    // 兑现/撤销兑现：愿望完成了就打个勾（只有自己能判断，不涉及奖励）
    case 'REWARD_REDEEM': {
      const done = P.rewardsDone || []
      return { ...s, profile: { ...P, rewardsDone: done.includes(a.id) ? done.filter((x) => x !== a.id) : [...done, a.id] } }
    }
    // 把一粒已解锁的种子种进空盆
    case 'PLANT_POT': {
      if (!(P.unlockedKinds || []).includes(a.kind)) return s
      return {
        ...s,
        profile: { ...P, pots: P.pots.map((x) => (x.id === a.potId && !x.kind ? { ...x, kind: a.kind, pts: 0 } : x)) },
      }
    }
    // 采集盛开的植物：盆清空，换金币，品种进图鉴
    case 'HARVEST': {
      const pot = P.pots.find((x) => x.id === a.potId)
      if (!pot || !pot.kind || pot.pts < BLOOM_PTS) return s
      return {
        ...s,
        profile: {
          ...P,
          coins: P.coins + a.coins,
          pots: P.pots.map((x) => (x.id === a.potId ? { ...x, kind: '', pts: 0 } : x)),
          collection: (P.collection || []).includes(pot.kind) ? P.collection : [...(P.collection || []), pot.kind],
        },
      }
    }

    // ---------- 成就 ----------
    case 'ACH_UNLOCK': {
      if (P.achievements?.[a.id]) return s
      return { ...s, profile: { ...P, coins: P.coins + (a.coins || 0), achievements: { ...P.achievements, [a.id]: t } } }
    }
    // 自定义成就：记录定义（解锁仍走 ACH_UNLOCK，统一入奖杯墙）
    case 'ACH_CUSTOM_ADD':
      return { ...s, profile: { ...P, customAch: [...(P.customAch || []), { id: `c-${uid()}`, ...a.meta }] } }
    case 'ACH_CUSTOM_DEL':
      return {
        ...s,
        profile: {
          ...P,
          customAch: (P.customAch || []).filter((x) => x.id !== a.id),
          achievements: Object.fromEntries(Object.entries(P.achievements || {}).filter(([k]) => k !== a.id)),
        },
      }

    // ---------- 待办（v2 支持重复待办） ----------
    case 'TODO_ADD':
      return {
        ...s,
        todos: [{ id: uid(), text: a.text, cat: a.cat || '生活', prio: !!a.prio, done: false, day: a.day || t, repeat: a.repeat || '', lastDone: '', diff: a.diff || 2 }, ...s.todos],
      }
    case 'TODO_TOGGLE': {
      const todo = s.todos.find((x) => x.id === a.id)
      if (!todo) return s
      // 重复待办：翻转的是「今天做没做」（lastDone），本体永远留在清单里
      if (todo.repeat) {
        const clickedDay = a.day || t
        const undo = todo.lastDone === clickedDay
        return {
          ...s,
          todos: s.todos.map((x) => (x.id === a.id ? { ...x, lastDone: undo ? '' : clickedDay } : x)),
          profile: undo ? s.profile : { ...P, stats: { ...P.stats, todosDone: (P.stats?.todosDone || 0) + 1 } },
        }
      }
      const nowDone = !todo.done
      // 完成逾期待办时把 day 挪到今天：否则该条会「既不在清单、也不在今日已完成」而凭空消失（全面检查发现）
      return {
        ...s,
        todos: s.todos.map((x) => (x.id === a.id ? { ...x, done: nowDone, day: nowDone ? t : x.day } : x)),
        profile: nowDone ? { ...P, stats: { ...P.stats, todosDone: (P.stats?.todosDone || 0) + 1 } } : s.profile,
      }
    }
    case 'TODO_POSTPONE':
      return { ...s, todos: s.todos.map((x) => (x.id === a.id ? { ...x, day: a.day } : x)) }
    case 'TODO_DEL':
      return { ...s, todos: s.todos.filter((x) => x.id !== a.id) }
    case 'TODO_CLEAR_DONE':
      return { ...s, todos: s.todos.filter((x) => !(x.done && x.day === t)) }
    // 历史数据卫生：把所有「已完成」的一次清掉（重复待办 done 恒为 false，天然不受影响）
    case 'TODO_CLEAR_ALL_DONE':
      return { ...s, todos: s.todos.filter((x) => !x.done) }

    // ---------- 账本（v2 加预算） ----------
    case 'LEDGER_ADD':
      return {
        ...s,
        ledger: [{ id: uid(), day: a.day || t, type: a.dir, amount: a.amount, cat: a.cat, note: a.note || '' }, ...s.ledger],
        profile: { ...P, stats: { ...P.stats, ledger: (P.stats?.ledger || 0) + 1 } },
      }
    case 'LEDGER_DEL':
      return { ...s, ledger: s.ledger.filter((x) => x.id !== a.id) }
    case 'BUDGET_SET': {
      const b = { ...(s.budgets || {}) }
      if (a.amount > 0) b[a.cat] = a.amount
      else delete b[a.cat]
      return { ...s, budgets: b }
    }

    // ---------- 习惯 ----------
    case 'HABIT_ADD':
      return { ...s, habits: [...s.habits, { id: uid(), name: a.name, icon: a.icon, color: a.color || 'green', days: {}, diff: a.diff || 2 }] }
    case 'HABIT_TOGGLE': {
      return {
        ...s,
        habits: s.habits.map((h) => {
          if (h.id !== a.id) return h
          const days = { ...h.days }
          if (days[a.day]) delete days[a.day]
          else days[a.day] = 1
          return { ...h, days }
        }),
      }
    }
    case 'HABIT_DEL':
      return { ...s, habits: s.habits.filter((h) => h.id !== a.id) }

    // ---------- 学习 ----------
    case 'STUDY_ADD':
      return { ...s, study: [...s.study, { id: uid(), title: a.title, targetH: a.targetH || 10, deadline: a.deadline || '', sessions: [] }] }
    case 'STUDY_LOG':
      return {
        ...s,
        study: s.study.map((p) => (p.id === a.id
          ? { ...p, sessions: [...p.sessions, { day: t, min: a.min, note: a.note || '' }] }
          : p)),
      }
    case 'STUDY_DEL':
      return { ...s, study: s.study.filter((p) => p.id !== a.id) }
    // 番茄钟完成：可挂在学习计划上，也可以只是自由专注
    case 'POMO_DONE': {
      const NP = { ...P, stats: { ...P.stats, pomos: (P.stats?.pomos || 0) + 1 } }
      if (!a.planId) return { ...s, profile: NP }
      return {
        ...s,
        profile: NP,
        study: s.study.map((p) => (p.id === a.planId
          ? { ...p, sessions: [...p.sessions, { day: t, min: a.min, note: a.note || '🍅 番茄钟', h: a.h ?? null }] }
          : p)),
      }
    }

    // ---------- 英语（v2：SRS 调度 + 自定义词单） ----------
    case 'ENGLISH_RESULT': {
      const e = { ...s.english }
      if (a.correct) {
        e.right += 1
        const ent = e.queue.find((q) => q.w === a.word)
        if (ent) {
          const interval = Math.min(180, Math.max(1, (ent.interval || 0) * 2))
          // 连对到 7 天以上就算「毕业」，从生词本移出
          if (interval >= 7) e.queue = e.queue.filter((q) => q.w !== a.word)
          else e.queue = e.queue.map((q) => (q.w === a.word ? { ...q, interval, due: addDays(t, interval) } : q))
        }
      } else {
        e.wrong += 1
        const ent = e.queue.find((q) => q.w === a.word)
        if (ent) e.queue = e.queue.map((q) => (q.w === a.word ? { ...q, interval: 0, due: t } : q))
        else e.queue = [...e.queue, { w: a.word, interval: 0, due: t }]
      }
      return { ...s, english: e }
    }
    case 'ENGLISH_KNOWN': {
      const e = { ...s.english }
      if (a.known) {
        if (!e.known.includes(a.word)) e.known = [...e.known, a.word]
        e.queue = e.queue.filter((q) => q.w !== a.word)
      } else {
        e.known = e.known.filter((w) => w !== a.word)
      }
      return { ...s, english: e }
    }
    case 'ENGLISH_IMPORT': {
      // 兜底去重：custom + 内置词 + 已掌握词 全部排除，防止任何调用路径产生同名条目
      const have = new Set([
        ...(s.english.custom || []).map((x) => x.w),
        ...WORDS.map((x) => x.w),
        ...(s.english.known || []),
      ])
      const add = (a.words || []).filter((x) => x.w && !have.has(x.w))
      return { ...s, english: { ...s.english, custom: [...(s.english.custom || []), ...add] } }
    }
    case 'ENGLISH_CUSTOM_DEL':
      return { ...s, english: { ...s.english, custom: (s.english.custom || []).filter((x) => x.w !== a.w) } }

    // ---------- 体重 ----------
    case 'WEIGHT_ADD': {
      const rest = s.weights.filter((x) => x.day !== a.day)
      return { ...s, weights: [...rest, { day: a.day, kg: a.kg }].sort((x, y) => (x.day < y.day ? -1 : 1)) }
    }
    case 'WEIGHT_DEL':
      return { ...s, weights: s.weights.filter((x) => x.day !== a.day) }

    case 'REVIEW_SAVE':
      return { ...s, reviews: { ...s.reviews, [a.day]: { mood: a.mood, good: a.good, thanks: a.thanks, tomorrow: a.tomorrow } } }

    case 'NEWS_SET':
      return { ...s, news: { cachedAt: a.cachedAt, items: a.items, source: a.source } }

    case 'CHAT_ADD': {
      const chat = [...s.chat, { role: a.role, content: a.content, t: Date.now() }]
      return { ...s, chat: chat.slice(-80) }
    }
    case 'CHAT_CLEAR':
      return { ...s, chat: [] }

    case 'EXPORT_MARK':
      return { ...s, profile: { ...P, lastExportDay: t } }
    case 'IMPORT': {
      // 备份刻意剥掉了 apiKey / webdavPass（见 webdav.backupPayload，防文件泄露）；
      // 导入时若备份里这两项为空，保留当前配置——否则恢复一次备份就把已配好的密钥清空了
      const cur = s.settings
      const next = hydrate(a.state)
      if (!(next.settings.apiKey || '').trim()) next.settings.apiKey = cur.apiKey
      if (!(next.settings.webdavPass || '').trim()) next.settings.webdavPass = cur.webdavPass
      return next
    }
    case 'RESET': return seed()
    default: return s
  }
}

const Ctx = createContext(null)

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, load)
  const timer = useRef(null)
  const stateRef = useRef(state) // 全局兜底保存用的最新 state（beforeunload 监听只注册一次，读 ref 不闭包过期值）
  const saveNow = () => { try { localStorage.setItem(LS_KEY, JSON.stringify(stateRef.current)) } catch { /* 存储满时忽略 */ } }
  useEffect(() => {
    stateRef.current = state
    clearTimeout(timer.current)
    timer.current = setTimeout(saveNow, 250)
    return () => clearTimeout(timer.current)
  }, [state])
  // 卸载 / 切后台兜底：防抖窗口内（操作后 250ms）刷新或关页也不丢最后一步
  useEffect(() => {
    const flush = () => saveNow()
    const onVis = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('beforeunload', flush)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('beforeunload', flush)
      document.removeEventListener('visibilitychange', onVis)
      clearTimeout(timer.current)
    }
  }, [])
  const value = useMemo(() => ({ state, dispatch }), [state])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useApp = () => useContext(Ctx)

// ---------- 常用查询 ----------
// 待办是否「今天该出现」：普通待办看 day，重复待办看 lastDone
export const isDue = (x, t = dayKey()) => {
  if (x.repeat === 'daily') return x.lastDone !== t
  if (x.repeat === 'weekly') return !x.lastDone || daysBetween(x.lastDone, t) >= 7
  return !x.done && x.day <= t
}
export const todosOpen = (s) => s.todos.filter((x) => isDue(x))
export const todosDoneToday = (s) => {
  const t = dayKey()
  return s.todos.filter((x) => (x.done && x.day === t) || (x.repeat && x.lastDone === t))
}

export const habitStreak = (h, ref = dayKey()) => {
  let k = ref
  if (!h.days[k]) k = addDays(k, -1)
  let n = 0
  while (h.days[k]) { n += 1; k = addDays(k, -1) }
  return n
}

export const balanceOf = (s) =>
  s.ledger.reduce((m, e) => m + (e.type === 'in' ? e.amount : -e.amount), 0)

export const monthInOut = (s, mk = monthKey()) => {
  let i = 0
  let o = 0
  for (const e of s.ledger) {
    if (!(e.day || '').startsWith(mk)) continue
    if (e.type === 'in') i += e.amount
    else o += e.amount
  }
  return { i, o }
}

export const lastWeight = (s) => (s.weights.length ? s.weights[s.weights.length - 1] : null)

export const studyDone = (plan) => plan.sessions.reduce((m, x) => m + (x.min || 0), 0)

export const bmiOf = (s) => {
  const w = lastWeight(s)
  if (!w || !s.profile.height) return null
  const h = s.profile.height / 100
  return +(w.kg / (h * h)).toFixed(1)
}
