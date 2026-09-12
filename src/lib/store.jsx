import { createContext, useContext, useEffect, useReducer, useRef } from 'react'
import { dayKey, addDays, monthKey, daysBetween } from './dates.js'
import { xpNeeded, emit } from './gamify.js'
import { WORDS } from './words.js'
import { thirstiestOf, growersOf } from './shop.js'
import { applyPull, syncOnState, syncBind, syncInit } from './sync.js'

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

// 数据封顶：每次 state 变化都会全量 JSON.stringify 写 localStorage（250ms 防抖），
// 无界数组会让保存成本随使用时间线性上涨。上限刻意给得极宽裕（正常使用触不到），
// 只在极端情况下裁掉最旧的，导出备份同样受此口径约束。
const MAX_LEDGER = 4000 // 约 10 年的每天一笔
const MAX_REVIEWS = 500 // 约 1.5 年的每日复盘
const MAX_WEIGHTS = 2000 // 约 5 年的每日上秤
const MAX_TRASH = 300 // 回收站条数封顶（超出裁最旧的，正常远触不到）
export const TRASH_DAYS = 30 // 软删除保留期：到期在 hydrate 时自动清理

// 参与云同步的顶层切片。reducer 外壳会对比前后 state，把「这次动作动过谁」记进 _touched
//（KV 型切片整体 LWW 用）；列表型切片的每条记录还有自己的 updatedAt（记录级 LWW 用）。
export const SYNC_KEYS = [
  'profile', 'settings', 'todos', 'ledger', 'habits', 'study', 'goals',
  'weights', 'reviews', 'english', 'budgets', 'claimed', 'xpLog', 'pomoLog', 'trash',
]

// ---------- 种子数据（首次打开是一座干净的空小镇；所有记录都靠自己动手，没有演示假数据） ----------
// 曾经这里预置过全套演示数据（演示账目/待办/习惯/体重/复盘等），造成「没记过却有数据、删了又回」的困惑
//（见踩坑指南）。删除后任何被清空/损坏/换端口都会回落 seed() 重新生成——这正是演示数据反复出现的根因。
export function seed() {
  const t = dayKey()
  return {
    v: 2,
    profile: {
      name: '小镇居民',
      height: 170,
      level: 1,
      xp: 0,
      coins: 0,
      streak: 0,
      lastActiveDay: '',
      waterTotal: 0,
      waterLastDay: '',
      // v2 花盆：id 只是盆位，kind 才是植物品种；kind 为空 = 空盆
      pots: [
        { id: 'pot-1', kind: '', pts: 0 },
        { id: 'pot-2', kind: '', pts: 0 },
        { id: 'pot-3', kind: '', pts: 0 },
      ],
      // 三种基础种子免费领养：空白开局也能立刻种下第一株，其余品种去商店解锁
      unlockedKinds: ['sunflower', 'tulip', 'berry'],
      collection: [],
      decor: [],
      hat: '',
      achievements: {},
      customAch: [],
      rewards: [],
      rewardsOwned: [],
      rewardsDone: [],
      weightGoal: null,
      lastExportDay: '',
      weekly: { week: '', id: '', claimed: false }, // 每周小挑战：week 是本周一 key，id 挑战模板，claimed 本周是否已领奖
      stats: { todosDone: 0, ledger: 0, pomos: 0 },
    },
    xpLog: {}, // 每日 XP 记录（热力图数据源），从自己第一次行动才慢慢亮起来
    pomoLog: [], // 每次专注完成记一条 { t, min, h, planId }，供「专注墙」收集展示（最多保留 200 条）
    xpToday: 0,
    xpTodayDay: t,
    claimed: {},
    budgets: {},
    todos: [],
    ledger: [],
    habits: [],
    study: [],
    goals: [], // 月度目标 { id, month, text, done, createdAt, doneAt, updatedAt }
    trash: [], // 回收站 { id, kind, refId, data, deletedAt, updatedAt, restoredAt }，新的在前
    // v2 生词本：queue 从 string 升级为 { w, due, interval }（简化间隔重复）
    english: { known: [], queue: [], right: 0, wrong: 0, custom: [] },
    weights: [],
    reviews: {},
    news: { cachedAt: 0, items: [], source: '' },
    chat: [
      { id: 'hello', role: 'assistant', content: '咕咕！我是阿咕，小镇的管家精灵 🐣\n可以问我「今天还剩几件事」「这个月花了多少」，或者直接说「帮我记一条待办：明天交报告」～' },
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
  s.profile.weekly = s.profile.weekly || { week: '', id: '', claimed: false }
  // 专注墙数据兜底：只保留结构合法的条目（脏条目会踩出 q.w 之类 TypeError）
  s.pomoLog = (s.pomoLog || []).filter((p) => p && p.t && typeof p.min === 'number')
  // 跨天修正：今日 XP / 礼箱按天重置。GRANT 分支也会重置，但「跨天首次打开页面、当天还没任何奖励动作」时，
  // 必须在这里就纠正——否则首页会把昨天的 XP 当成今天的展示（进度满但礼箱全可开，状态自相矛盾）。
  if (s.xpTodayDay !== dayKey()) {
    s.xpToday = 0
    s.xpTodayDay = dayKey()
  }
  // 生词本健康检查：任何版本档都可能混入脏条目（如手工编辑/第三方导入），一律踢掉并补全必填字段
  s.english.queue = (s.english.queue || [])
    .filter((q) => q && typeof q === 'object' && typeof q.w === 'string' && q.w)
    .map((q) => ({ ...q, interval: q.interval || 0, due: q.due || dayKey() }))
  // 聊天消息 id 兜底：旧档没有 id，回填后列表才能用稳定 key 渲染
  s.chat = (s.chat || []).map((m) => (m.id ? m : { ...m, id: uid() }))
  // v3 记录级 updatedAt 兜底：同步合并靠「新者胜」，旧档没有时间戳的一律补 0
  //（0 只会和同批旧档比较；一旦本机编辑过就会拿到真实时间戳并赢得合并）
  const at = (x) => (Number.isFinite(x?.updatedAt) ? x.updatedAt : 0)
  s.todos = (s.todos || []).map((x) => ({ ...x, updatedAt: at(x) }))
  s.ledger = (s.ledger || []).map((x) => ({ ...x, updatedAt: at(x) }))
  s.habits = (s.habits || []).map((x) => ({ ...x, updatedAt: at(x) }))
  s.study = (s.study || []).map((x) => ({ ...x, updatedAt: at(x) }))
  s.goals = (s.goals || []).map((x) => ({ ...x, updatedAt: at(x) }))
  // 体重原本以 day 为唯一键、没有 id：同步层按「记录必须带 id」处理，这里统一补 id=day
  s.weights = (s.weights || []).map((x) => ({ ...x, id: x.id || x.day, updatedAt: at(x) }))
  s.reviews = Object.fromEntries(
    Object.entries(s.reviews || {}).map(([d, r]) => [d, { ...r, updatedAt: at(r) }]),
  )
  s.trash = (s.trash || [])
    .map((x) => ({ ...x, updatedAt: at(x), restoredAt: x.restoredAt || 0 }))
    .filter((x) => x && x.refId && x.data) // 结构不合法的条目直接丢弃
  // 保留期到了的回收站条目自动清理（按 updatedAt 计——恢复也会刷新它；每次打开/导入都会走一遍，无需定时器）
  const expire = Date.now() - TRASH_DAYS * 86400000
  s.trash = s.trash.filter((x) => (x.updatedAt || 0) >= expire).slice(0, MAX_TRASH)
  // 历史超限数据的写入时裁剪（旧档一次性裁到位，口径与 reducer 封顶一致）
  s.ledger = (s.ledger || []).slice(0, MAX_LEDGER)
  s.weights = (s.weights || []).slice(-MAX_WEIGHTS)
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
const stamp = (x) => ({ ...x, updatedAt: Date.now() })

// 软删除：把一条记录移进回收站（墓碑）。restoredAt 记录「曾被恢复」——
// 同步时墓碑用来删掉其他设备上的同一条记录；恢复不是删条目，而是打上 restoredAt 标记，
// 这样多端不会出现「A 恢复了、B 又把墓碑推回来把记录删掉」的循环。
export function trashEntry(kind, refId, data) {
  return { id: uid(), kind, refId, data, deletedAt: Date.now(), updatedAt: Date.now(), restoredAt: 0 }
}
const withTrash = (s, entries) => [ ...entries, ...s.trash ].slice(0, MAX_TRASH)

function reducerRaw(s, a) {
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
      const target = thirstiestOf(pots, BLOOM_PTS)
      if (target) {
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
      // 指定 potId 只浇那一盆；否则自动挑最缺水的一盆（选盆逻辑与 Dashboard 预检共用 shop.js 的实现）
      const target = a.potId ? growersOf(pots, BLOOM_PTS).find((x) => x.id === a.potId) : thirstiestOf(pots, BLOOM_PTS)
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
        todos: [{ id: uid(), text: a.text, cat: a.cat || '生活', prio: !!a.prio, done: false, day: a.day || t, repeat: a.repeat || '', lastDone: '', diff: a.diff || 2, updatedAt: Date.now() }, ...s.todos],
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
          todos: s.todos.map((x) => (x.id === a.id ? stamp({ ...x, lastDone: undo ? '' : clickedDay }) : x)),
          profile: undo ? s.profile : { ...P, stats: { ...P.stats, todosDone: (P.stats?.todosDone || 0) + 1 } },
        }
      }
      const nowDone = !todo.done
      // 完成逾期待办时把 day 挪到今天：否则该条会「既不在清单、也不在今日已完成」而凭空消失（全面检查发现）
      return {
        ...s,
        todos: s.todos.map((x) => (x.id === a.id ? stamp({ ...x, done: nowDone, day: nowDone ? t : x.day }) : x)),
        profile: nowDone ? { ...P, stats: { ...P.stats, todosDone: (P.stats?.todosDone || 0) + 1 } } : s.profile,
      }
    }
    case 'TODO_POSTPONE':
      return { ...s, todos: s.todos.map((x) => (x.id === a.id ? stamp({ ...x, day: a.day }) : x)) }
    case 'TODO_DEL': {
      const td = s.todos.find((x) => x.id === a.id)
      if (!td) return s
      return { ...s, todos: s.todos.filter((x) => x.id !== a.id), trash: withTrash(s, [trashEntry('todo', td.id, td)]) }
    }
    case 'TODO_CLEAR_DONE': {
      const gone = s.todos.filter((x) => x.done && x.day === t)
      return {
        ...s,
        todos: s.todos.filter((x) => !(x.done && x.day === t)),
        trash: withTrash(s, gone.map((x) => trashEntry('todo', x.id, x))),
      }
    }
    // 历史数据卫生：把所有「已完成」的一次清掉（重复待办 done 恒为 false，天然不受影响）
    case 'TODO_CLEAR_ALL_DONE': {
      const gone = s.todos.filter((x) => x.done)
      return { ...s, todos: s.todos.filter((x) => !x.done), trash: withTrash(s, gone.map((x) => trashEntry('todo', x.id, x))) }
    }

    // ---------- 账本（v2 加预算） ----------
    case 'LEDGER_ADD':
      return {
        ...s,
        ledger: [{ id: uid(), day: a.day || t, type: a.dir, amount: a.amount, cat: a.cat, note: a.note || '', updatedAt: Date.now() }, ...s.ledger].slice(0, MAX_LEDGER),
        profile: { ...P, stats: { ...P.stats, ledger: (P.stats?.ledger || 0) + 1 } },
      }
    case 'LEDGER_DEL': {
      const e = s.ledger.find((x) => x.id === a.id)
      if (!e) return s
      return { ...s, ledger: s.ledger.filter((x) => x.id !== a.id), trash: withTrash(s, [trashEntry('ledger', e.id, e)]) }
    }
    case 'BUDGET_SET': {
      const b = { ...(s.budgets || {}) }
      if (a.amount > 0) b[a.cat] = a.amount
      else delete b[a.cat]
      return { ...s, budgets: b }
    }

    // ---------- 习惯 ----------
    case 'HABIT_ADD':
      return { ...s, habits: [...s.habits, { id: uid(), name: a.name, icon: a.icon, color: a.color || 'green', days: {}, diff: a.diff || 2, updatedAt: Date.now() }] }
    case 'HABIT_TOGGLE': {
      return {
        ...s,
        habits: s.habits.map((h) => {
          if (h.id !== a.id) return h
          const days = { ...h.days }
          if (days[a.day]) delete days[a.day]
          else days[a.day] = 1
          return stamp({ ...h, days })
        }),
      }
    }
    case 'HABIT_DEL': {
      const h = s.habits.find((x) => x.id === a.id)
      if (!h) return s
      return { ...s, habits: s.habits.filter((x) => x.id !== a.id), trash: withTrash(s, [trashEntry('habit', h.id, h)]) }
    }

    // ---------- 学习 ----------
    case 'STUDY_ADD':
      return { ...s, study: [...s.study, { id: uid(), title: a.title, targetH: a.targetH || 10, deadline: a.deadline || '', sessions: [], updatedAt: Date.now() }] }
    case 'STUDY_LOG':
      return {
        ...s,
        study: s.study.map((p) => (p.id === a.id
          ? stamp({ ...p, sessions: [...p.sessions, { day: t, min: a.min, note: a.note || '' }] })
          : p)),
      }
    case 'STUDY_DEL': {
      const p = s.study.find((x) => x.id === a.id)
      if (!p) return s
      return { ...s, study: s.study.filter((x) => x.id !== a.id), trash: withTrash(s, [trashEntry('study', p.id, p)]) }
    }
    // 番茄钟完成：可挂在学习计划上，也可以只是自由专注；每次完成都记一条「专注墙」条目
    case 'POMO_DONE': {
      const NP = { ...P, stats: { ...P.stats, pomos: (P.stats?.pomos || 0) + 1 } }
      const pok = { t, min: Math.round(a.min) || 0, h: a.h ?? new Date().getHours(), planId: a.planId || '' }
      const pomoLog = [...(s.pomoLog || []), pok].slice(-200)
      if (!a.planId) return { ...s, profile: NP, pomoLog }
      return {
        ...s,
        profile: NP,
        pomoLog,
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
      return { ...s, weights: [...rest, { id: a.day, day: a.day, kg: a.kg, updatedAt: Date.now() }].sort((x, y) => (x.day < y.day ? -1 : 1)).slice(-MAX_WEIGHTS) }
    }
    case 'WEIGHT_DEL': {
      const w = s.weights.find((x) => x.day === a.day)
      if (!w) return s
      return { ...s, weights: s.weights.filter((x) => x.day !== a.day), trash: withTrash(s, [trashEntry('weight', w.id || w.day, w)]) }
    }

    case 'REVIEW_SAVE': {
      const reviews = { ...s.reviews, [a.day]: { mood: a.mood, good: a.good, thanks: a.thanks, tomorrow: a.tomorrow, ask: a.ask || '', updatedAt: Date.now() } }
      const keys = Object.keys(reviews)
      if (keys.length > MAX_REVIEWS) {
        // 日期 key 排序后裁掉最早的，封顶见 MAX_REVIEWS 注释
        for (const k of keys.sort().slice(0, keys.length - MAX_REVIEWS)) delete reviews[k]
      }
      return { ...s, reviews }
    }

    // ---------- 月度目标（达成时由页面层追加 GRANT 发奖，宽恕优先不追回） ----------
    case 'GOAL_ADD':
      return {
        ...s,
        goals: [...(s.goals || []), { id: uid(), month: a.month || t.slice(0, 7), text: a.text, done: false, createdAt: Date.now(), doneAt: 0, updatedAt: Date.now() }],
      }
    case 'GOAL_TOGGLE': {
      const g = (s.goals || []).find((x) => x.id === a.id)
      if (!g) return s
      const done = !g.done
      return { ...s, goals: s.goals.map((x) => (x.id === a.id ? stamp({ ...x, done, doneAt: done ? Date.now() : 0 }) : x)) }
    }
    case 'GOAL_DEL': {
      const g = (s.goals || []).find((x) => x.id === a.id)
      if (!g) return s
      return { ...s, goals: s.goals.filter((x) => x.id !== a.id), trash: withTrash(s, [trashEntry('goal', g.id, g)]) }
    }

    // ---------- 回收站 ----------
    // 恢复：墓碑打上 restoredAt（不删条目，同步靠它压制其他设备的「删除」），记录本体带新时间戳放回原集合
    case 'TRASH_RESTORE': {
      const ent = s.trash.find((x) => x.id === a.id)
      if (!ent || ent.restoredAt) return s // 已恢复过 → 幂等返回（记录已在清单里）
      const rec = stamp({ ...ent.data })
      let next = { ...s }
      if (ent.kind === 'todo') next.todos = [rec, ...s.todos.filter((x) => x.id !== ent.refId)]
      else if (ent.kind === 'ledger') next.ledger = [rec, ...s.ledger.filter((x) => x.id !== ent.refId)]
      else if (ent.kind === 'habit') next.habits = [rec, ...s.habits.filter((x) => x.id !== ent.refId)]
      else if (ent.kind === 'study') next.study = [...s.study.filter((x) => x.id !== ent.refId), rec]
      else if (ent.kind === 'goal') next.goals = [...(s.goals || []).filter((x) => x.id !== ent.refId), rec]
      else if (ent.kind === 'weight') {
        next.weights = [...s.weights.filter((x) => x.day !== ent.refId), rec].sort((x, y) => (x.day < y.day ? -1 : 1))
      } else return s
      next.trash = s.trash.map((x) => (x.id === a.id ? stamp({ ...x, restoredAt: Date.now() }) : x))
      return next
    }
    case 'TRASH_PURGE':
      return { ...s, trash: s.trash.filter((x) => x.id !== a.id) }
    case 'TRASH_EMPTY':
      return { ...s, trash: [] }

    case 'NEWS_SET':
      return { ...s, news: { cachedAt: a.cachedAt, items: a.items, source: a.source } }

    case 'CHAT_ADD': {
      // id 用作列表 key：满 80 条开始滑动裁剪后，index key 会让整个列表卸载重挂
      const chat = [...s.chat, { id: a.id || uid(), role: a.role, content: a.content, t: Date.now() }]
      return { ...s, chat: chat.slice(-80) }
    }
    case 'CHAT_CLEAR':
      return { ...s, chat: [] }

    case 'EXPORT_MARK':
      return { ...s, profile: { ...P, lastExportDay: t } }
    // 每周小挑战达成：发金币并标记本周已领（roll 挑战本身由 App 层做；已领则幂等忽略）
    case 'CHALLENGE_CLAIM': {
      if (P.weekly?.claimed) return s
      return {
        ...s,
        profile: { ...P, coins: P.coins + (a.coins || 0), weekly: { ...(P.weekly || { week: '', id: '', claimed: false }), claimed: true } },
      }
    }
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
    // 云同步拉取：把远端数据按记录级 LWW 并进本地（applyPull 纯函数，没变化返回原 state）
    case 'SYNC_MERGE': return applyPull(s, a.data).state
    default: return s
  }
}

// reducer 外壳：动作处理完后对比前后 state，把被触碰的顶层切片记进 _touched（毫秒时间戳）。
// 列表记录的合并用每条记录自己的 updatedAt；profile/english/budgets 这类 KV 型切片没有记录级
// 结构，就用 _touched[key] 当「整块」的时间戳做新者胜。key 没变就不写，避免无谓的时间戳抖动。
export function reducer(s, a) {
  const next = reducerRaw(s, a)
  if (next === s) return s
  const touched = { ...(s._touched || {}) }
  let dirty = false
  for (const k of SYNC_KEYS) {
    if (next[k] !== s[k]) { touched[k] = Date.now(); dirty = true }
  }
  return dirty ? { ...next, _touched: touched } : next
}

const StateCtx = createContext(null)
const DispatchCtx = createContext(null)

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, load)
  const timer = useRef(null)
  const stateRef = useRef(state) // 全局兜底保存用的最新 state（beforeunload 监听只注册一次，读 ref 不闭包过期值）
  const saveNow = () => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(stateRef.current)) }
    catch {
      // 存储满 / 隐私模式被拒时静默会让人「不知不觉丢数据」，必须明说
      emit('toast', { icon: '⚠️', text: '本地存档空间满了，这次改动没能存下来，请尽快导出备份或精简数据' })
    }
  }
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
      window.removeEventListener('visibilitychange', onVis)
      clearTimeout(timer.current)
    }
  }, [])
  // 云同步（可选）：state 变化喂给引擎（引擎自己防抖 push）；启动时注册 commit + 定时 pull
  useEffect(() => { syncOnState(state) }, [state])
  useEffect(() => {
    syncBind((data) => dispatch({ type: 'SYNC_MERGE', data }))
    return syncInit()
  }, [dispatch])
  // state 与 dispatch 分两个 Context：dispatch 引用永远稳定，只需要发动作的组件
  // （用 useDispatch）订阅 DispatchCtx，就不会被任何 state 变化牵连重渲染
  return (
    <DispatchCtx.Provider value={dispatch}>
      <StateCtx.Provider value={state}>{children}</StateCtx.Provider>
    </DispatchCtx.Provider>
  )
}

export const useApp = () => ({ state: useContext(StateCtx), dispatch: useContext(DispatchCtx) })
// 只要发动作、不读数据的组件用它：state 变化不再牵连重渲染
export const useDispatch = () => useContext(DispatchCtx)

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
