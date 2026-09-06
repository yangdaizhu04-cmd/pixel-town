import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react'
import { dayKey, addDays, monthKey } from './dates.js'
import { xpNeeded } from './gamify.js'

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
function seed() {
  const t = dayKey()
  const d = (n) => addDays(t, -n)
  return {
    v: 1,
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
      pots: [
        { id: 'sunflower', pts: 10 },
        { id: 'tulip', pts: 6 },
        { id: 'berry', pts: 2 },
      ],
    },
    xpToday: 55,
    xpTodayDay: t,
    claimed: { [t]: [] },
    todos: [
      { id: uid(), text: '给小镇写一封本周小结', cat: '工作', prio: true, done: false, day: t },
      { id: uid(), text: '伸展 5 分钟，看看窗外的云', cat: '生活', prio: false, done: false, day: t },
      { id: uid(), text: '把明天要用的资料打印好', cat: '工作', prio: false, done: false, day: addDays(t, 1) },
      { id: uid(), text: '读完《深度工作》第 3 章', cat: '学习', prio: false, done: true, day: t },
      { id: uid(), text: '回复合作邮件', cat: '工作', prio: false, done: true, day: d(1) },
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
      { id: uid(), name: '喝够 8 杯水', icon: '💧', color: 'blue', days: { [d(4)]: 1, [d(3)]: 1, [d(2)]: 1, [d(1)]: 1, [t]: 1 } },
      { id: uid(), name: '拉伸 10 分钟', icon: '🧘', color: 'pink', days: { [d(3)]: 1, [d(2)]: 1, [t]: 1 } },
      { id: uid(), name: '23:30 前睡觉', icon: '🛏️', color: 'orange', days: { [d(2)]: 1, [d(1)]: 1 } },
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
    english: { known: [], queue: [], right: 0, wrong: 0 },
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
    },
  }
}

// ---------- Reducer ----------
function reducer(s, a) {
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
      // 自动浇水：完成事情会让花园长一点
      const pots = P.pots.map((x) => ({ ...x }))
      const target = [...pots].sort((x, y) => x.pts - y.pts)[0]
      if (target && target.pts < BLOOM_PTS) target.pts += 1
      P.pots = pots
      P.waterTotal = (P.waterTotal || 0) + 1
      const xpTodayDay = s.xpTodayDay === t ? s.xpTodayDay : t
      return { ...s, profile: P, xpToday: s.xpTodayDay === t ? s.xpToday + (a.xp || 0) : (a.xp || 0), xpTodayDay }
    }

    case 'MILESTONE_CLAIM': {
      const list = s.claimed[t] || []
      if (list.includes(a.at)) return s
      P.coins += a.coins
      return { ...s, profile: P, claimed: { ...s.claimed, [t]: [...list, a.at] } }
    }

    case 'WATER': {
      if ((a.cost || 0) > P.coins) return s
      const pots = P.pots.map((x) => ({ ...x }))
      const target = [...pots].sort((x, y) => x.pts - y.pts)[0]
      const grown = target && target.pts < BLOOM_PTS
      if (target && grown) target.pts += 1
      P.pots = pots
      P.waterTotal = (P.waterTotal || 0) + 1
      P.waterLastDay = t
      P.coins -= a.cost || 0
      return { ...s, profile: P, justGrew: grown ? target.id : null }
    }

    case 'TODO_ADD':
      return { ...s, todos: [{ id: uid(), text: a.text, cat: a.cat || '生活', prio: !!a.prio, done: false, day: a.day || t }, ...s.todos] }
    case 'TODO_TOGGLE':
      return { ...s, todos: s.todos.map((x) => (x.id === a.id ? { ...x, done: !x.done } : x)) }
    case 'TODO_DEL':
      return { ...s, todos: s.todos.filter((x) => x.id !== a.id) }
    case 'TODO_CLEAR_DONE':
      return { ...s, todos: s.todos.filter((x) => !(x.done && x.day === t)) }

    case 'LEDGER_ADD':
      return { ...s, ledger: [{ id: uid(), day: a.day || t, type: a.dir, amount: a.amount, cat: a.cat, note: a.note || '' }, ...s.ledger] }
    case 'LEDGER_DEL':
      return { ...s, ledger: s.ledger.filter((x) => x.id !== a.id) }

    case 'HABIT_ADD':
      return { ...s, habits: [...s.habits, { id: uid(), name: a.name, icon: a.icon, color: a.color || 'green', days: {} }] }
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

    case 'ENGLISH_RESULT': {
      const e = { ...s.english }
      if (a.correct) { e.right += 1; e.queue = e.queue.filter((w) => w !== a.word) } else { e.wrong += 1; if (!e.queue.includes(a.word)) e.queue = [...e.queue, a.word] }
      return { ...s, english: e }
    }
    case 'ENGLISH_KNOWN': {
      const e = { ...s.english }
      if (a.known) { if (!e.known.includes(a.word)) e.known = [...e.known, a.word]; e.queue = e.queue.filter((w) => w !== a.word) } else { e.known = e.known.filter((w) => w !== a.word) }
      return { ...s, english: e }
    }

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

    case 'IMPORT': return { ...a.state }
    case 'RESET': return seed()
    default: return s
  }
}

// ---------- 持久化 ----------
function load() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return seed()
    const parsed = JSON.parse(raw)
    if (!parsed || !parsed.profile) return seed()
    const base = seed()
    return { ...base, ...parsed, profile: { ...base.profile, ...parsed.profile }, settings: { ...base.settings, ...parsed.settings } }
  } catch {
    return seed()
  }
}

const Ctx = createContext(null)

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, load)
  const timer = useRef(null)
  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      try { localStorage.setItem(LS_KEY, JSON.stringify(state)) } catch { /* 存储满时忽略 */ }
    }, 250)
    return () => clearTimeout(timer.current)
  }, [state])
  const value = useMemo(() => ({ state, dispatch }), [state])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useApp = () => useContext(Ctx)

// ---------- 常用查询 ----------
export const todosOpen = (s) => s.todos.filter((x) => !x.done && x.day <= dayKey())
export const todosDoneToday = (s) => s.todos.filter((x) => x.done && x.day === dayKey())

export const habitStreak = (h) => {
  let k = dayKey()
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

export { monthKey }
