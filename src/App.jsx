import React, { useEffect, useRef, useState } from 'react'
import { useApp } from './lib/store.jsx'
import { gsap, useGSAP, D } from './lib/anim.js'
import { sfx, setMuted, xpNeeded, emit, on, reward } from './lib/gamify.js'
import { PixelSprite } from './lib/sprites.jsx'
import { Chip, Btn, Bar, ConfirmHost } from './components/ui.jsx'
import { ToastHost, ConfettiHost, LevelUpModal } from './components/effects.jsx'
import SettingsModal from './components/SettingsModal.jsx'
import { pomoSubscribe, pomoStartBreak, pomoSnap } from './lib/pomo.js'
import { ACHIEVEMENTS } from './lib/achievements.js'
import { PLANT_META } from './lib/shop.js'
import { dayKey, pickByDay, daysBetween } from './lib/dates.js'
import Dashboard from './pages/Dashboard.jsx'
import Todos from './pages/Todos.jsx'
import Ledger from './pages/Ledger.jsx'
import Habits from './pages/Habits.jsx'
import News from './pages/News.jsx'
import Study from './pages/Study.jsx'
import English from './pages/English.jsx'
import Weight from './pages/Weight.jsx'
import Review from './pages/Review.jsx'
import Museum from './pages/Museum.jsx'
import AgentChat, { BirdAvatar } from './components/AgentChat.jsx'

const PAGES = [
  { id: 'home', icon: '🏠', label: '首页总览', comp: Dashboard },
  { id: 'todos', icon: '📝', label: '待办清单', comp: Todos },
  { id: 'ledger', icon: '💰', label: '收支账本', comp: Ledger },
  { id: 'habits', icon: '✅', label: '习惯打卡', comp: Habits },
  { id: 'news', icon: '📰', label: '每日 AI 新闻', comp: News },
  { id: 'study', icon: '📚', label: '学习计划', comp: Study },
  { id: 'english', icon: '🔤', label: '英语练习', comp: English },
  { id: 'weight', icon: '⚖️', label: '体重记录', comp: Weight },
  { id: 'review', icon: '🌙', label: '每日复盘', comp: Review },
  { id: 'museum', icon: '🏛️', label: '小镇年鉴', comp: Museum },
  { id: 'agent', icon: '🐣', label: '小镇精灵', comp: AgentChat },
]
const HOTKEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-']

const TIPS = [
  '完成任务会自动给花园浇水，每天第一次手动浇水免费。',
  '今日 XP 达到 25 / 50 / 80 / 120 时，记得开冒险礼箱！',
  '写一篇复盘 +15 XP，还能点亮心情月历。',
  '答错的单词会自动住进生词本，按遗忘曲线催你复习。',
  '盛开的植物可以「采集种子」换金币，再去商店买新花盆！',
  '番茄钟挂在「学习计划」页，切页也会继续走。',
  '数字键 1-9、0、- 可以快速切页。',
  '月底记得去账本看看「钱都去哪了」，还能设预算。',
  '把明天的第一件事写小一点，小到不可能失败。',
]

// 番茄钟迷你指示器：运行中切到别的页面时也能看到进度
function PomoBadge({ onGo }) {
  const [pomo, setPomo] = useState(null)
  useEffect(() => pomoSubscribe(setPomo), [])
  if (!pomo || (!pomo.running && pomo.left === pomo.total)) return null
  const mm = String(Math.floor(pomo.left / 60)).padStart(2, '0')
  const ss = String(pomo.left % 60).padStart(2, '0')
  const isBreak = pomo.mode === 'break'
  return (
    <button className={`pomo-badge ${pomo.running ? 'run' : ''} ${isBreak ? 'brk' : ''}`} onClick={onGo} title={isBreak ? '休息轮进行中，点回学习页' : '番茄钟进行中，点回学习页'}>
      {isBreak ? '☕' : '🍅'} {mm}:{ss}
    </button>
  )
}

export default function App() {
  const { state, dispatch } = useApp()
  const [page, setPage] = useState('home')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [levelUp, setLevelUp] = useState(null)
  const mainRef = useRef(null)
  const levelRef = useRef(state.profile.level)

  // 音效开关
  useEffect(() => { setMuted(!state.settings.sound) }, [state.settings.sound])

  // 番茄钟完成：专注轮 → 记时长发奖励并自动接休息轮；休息轮 → 只提醒不奖励（休息不该被 KPI 化）
  useEffect(() => on('pomo-done', ({ detail }) => {
    const { min, planId, mode } = detail || {}
    sfx('alarm')
    if (mode === 'break') {
      emit('toast', { icon: '☀️', text: '休息完毕！准备好就开始下一个番茄吧' })
      return
    }
    dispatch({ type: 'POMO_DONE', min, planId, h: new Date().getHours() })
    const xp = Math.min(30, Math.max(5, Math.round((min / 30) * 10)))
    const coins = min >= 30 ? 3 : 1
    reward(dispatch, { xp, coins, msg: `专注 ${min} 分钟`, icon: '🍅', confetti: true })
    pomoStartBreak()
    emit('toast', { icon: '☕', text: `休息 ${pomoSnap().total / 60} 分钟，阿咕替你看着钟` })
  }), [])

  // 升级检测
  useEffect(() => {
    if (state.profile.level > levelRef.current) {
      setLevelUp(state.profile.level)
      sfx('levelup')
    }
    levelRef.current = state.profile.level
  }, [state.profile.level])

  // 成就检测：内置 + 自定义计数型，每次状态变化跑一遍纯函数判定，解锁的发金币 + 喜报
  useEffect(() => {
    const unlocked = state.profile.achievements || {}
    for (const a of ACHIEVEMENTS) {
      if (!unlocked[a.id] && a.check(state, PLANT_META.length)) {
        dispatch({ type: 'ACH_UNLOCK', id: a.id, coins: a.coins })
        sfx('coin')
        emit('toast', { icon: '🏆', text: `解锁成就「${a.name}」！+${a.coins} 金币` })
      }
    }
    for (const c of state.profile.customAch || []) {
      if (c.metric === 'manual') continue
      const val = c.metric === 'streak' ? state.profile.streak : (state.profile.stats?.[c.metric] || 0)
      if (!unlocked[c.id] && val >= c.target) {
        dispatch({ type: 'ACH_UNLOCK', id: c.id, coins: c.coins })
        sfx('coin')
        emit('toast', { icon: '🏆', text: `解锁成就「${c.name}」！+${c.coins} 金币` })
      }
    }
  }, [state]) // eslint-disable-line react-hooks/exhaustive-deps

  // 备份提醒：从没导出过 / 超过 7 天没导出，进首页轻声提一句
  useEffect(() => {
    const last = state.profile.lastExportDay
    if (!last || daysBetween(last, dayKey()) >= 7) {
      const timer = setTimeout(() => {
        emit('toast', { icon: '💾', text: '好久没备份小镇啦，设置里可以导出或云备份' })
      }, 2500)
      return () => clearTimeout(timer)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 键盘快捷键：数字键切页（输入框/弹窗打开时不劫持）
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tag = (e.target.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return
      if (document.querySelector('.overlay')) return
      const i = HOTKEYS.indexOf(e.key)
      if (i >= 0 && PAGES[i]) {
        sfx('click')
        setPage(PAGES[i].id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // 金币跳动
  useEffect(() => {
    const el = document.querySelector('.wallet')
    if (el) {
      gsap.killTweensOf(el)
      gsap.fromTo(el, { scale: 1.14 }, { scale: 1, duration: D(0.35), ease: 'back.out(2)' })
    }
  }, [state.profile.coins])

  // 环境云朵
  useGSAP(() => {
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.utils.toArray('.cloud').forEach((el, i) => {
        gsap.fromTo(el,
          { x: -280 },
          { x: () => window.innerWidth + 280, duration: 80 + i * 35, repeat: -1, ease: 'none', delay: -(i * 27) })
      })
    })
  }, [])

  // 页面切换动画（fromTo + overwrite：即便上一条补间被 HMR/热更新打断，
  // 下一次切换也会从显式起点重置，元素不会被钉在 visibility:hidden）
  useGSAP(() => {
    gsap.fromTo('.card',
      { y: 24, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: D(0.42), stagger: 0.055, ease: 'power2.out', clearProps: 'all', overwrite: true })
  }, { dependencies: [page], scope: mainRef, revertOnUpdate: true })

  // 切页回顶部
  useEffect(() => { window.scrollTo({ top: 0 }) }, [page])

  // 标签页标题：挂后台也能看出在哪页、番茄钟还剩多久
  const pageRef = useRef(page)
  pageRef.current = page
  useEffect(() => {
    const pageTitle = () => {
      const p = PAGES.find((x) => x.id === pageRef.current)
      document.title = `${p.icon} ${p.label} · 拾光小镇`
    }
    pageTitle()
    return pomoSubscribe((s) => {
      if (s.running || s.left !== s.total) {
        const mm = String(Math.floor(s.left / 60)).padStart(2, '0')
        const ss = String(s.left % 60).padStart(2, '0')
        document.title = `${s.mode === 'break' ? '☕' : '🍅'} ${mm}:${ss} ${s.mode === 'break' ? '休息' : '专注'}中 · 拾光小镇`
      } else {
        pageTitle()
      }
    })
  }, [])
  // 空闲时切页刷新标题；番茄钟进行中则让位给倒计时标题（由上面的订阅者持续刷新）
  useEffect(() => {
    const s = pomoSnap()
    if (s.running || s.left !== s.total) return
    const p = PAGES.find((x) => x.id === page)
    document.title = `${p.icon} ${p.label} · 拾光小镇`
  }, [page])

  const { profile } = state
  const need = xpNeeded(profile.level)
  const Cur = PAGES.find((p) => p.id === page).comp

  return (
    <div className="app">
      <div className="sky" aria-hidden="true">
        <div className="cloud c1"><PixelSprite name="cloud" scale={4} /></div>
        <div className="cloud c2"><PixelSprite name="cloud" scale={3} /></div>
        <div className="cloud c3"><PixelSprite name="cloud" scale={2.5} /></div>
      </div>
      <div className="hills" aria-hidden="true"><div className="hill h1" /><div className="hill h2" /><div className="hill h3" /></div>

      <header className="topbar">
        <div className="brand card">
          <PixelSprite name="bloom_sun" scale={3} />
          <div>
            <h1>拾光小镇</h1>
            <p>把每天的进步，都种进花园里</p>
          </div>
        </div>
        <div className="topbar-right">
          <Chip className="lv" title={`距下一级还差 ${need - profile.xp} XP`}>Lv.{profile.level} <em className="lv-xp">{profile.xp}/{need} XP</em></Chip>
          <Chip className="wallet" title="金币：完成任务赚，商店和浇水花">🪙 {profile.coins}</Chip>
          <Btn size="sm" title="设置" onClick={() => setSettingsOpen(true)}>⚙️</Btn>
        </div>
      </header>

      <div className="shell">
        <aside className="sidebar card">
          <nav className="nav">
            {PAGES.map((p) => (
              <button
                key={p.id}
                className={`nav-item ${page === p.id ? 'active' : ''}`}
                aria-current={page === p.id ? 'page' : undefined}
                onClick={() => { if (page !== p.id) { sfx('click'); setPage(p.id) } }}
              >
                <span className="nav-icon">{p.icon}</span>
                <span>{p.label}</span>
              </button>
            ))}
          </nav>
          <div className="elder">
            <h4>🧙 村长的提醒</h4>
            <Bar pct={(profile.xp / need) * 100} color="gold" />
            <p className="elder-sub">Lv.{profile.level} · {profile.xp}/{need} XP · 连续 {profile.streak} 天</p>
            <p className="elder-tip">{pickByDay(TIPS, 'tip')}</p>
          </div>
        </aside>

        <main className="page" ref={mainRef} key={page}>
          {page === 'agent'
            ? <AgentChat onOpenSettings={() => setSettingsOpen(true)} />
            : <Cur />}
        </main>
      </div>

      {page !== 'agent' && (
        <button className="fab" title="和阿咕聊聊" onClick={() => { sfx('pop'); setPage('agent') }}>
          <BirdAvatar scale={3} />
        </button>
      )}
      <PomoBadge onGo={() => { sfx('click'); setPage('study') }} />

      <ToastHost />
      <ConfettiHost />
      <ConfirmHost />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <LevelUpModal level={levelUp} onClose={() => setLevelUp(null)} />
    </div>
  )
}
