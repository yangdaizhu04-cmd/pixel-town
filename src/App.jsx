import React, { useEffect, useRef, useState } from 'react'
import { useApp, bmiOf } from './lib/store.jsx'
import { gsap, useGSAP, D } from './lib/anim.js'
import { emitConfetti, sfx, setMuted, xpNeeded } from './lib/gamify.js'
import { PixelSprite } from './lib/sprites.jsx'
import { Chip, Btn, Bar } from './components/ui.jsx'
import { ToastHost, ConfettiHost, LevelUpModal } from './components/effects.jsx'
import SettingsModal from './components/SettingsModal.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Todos from './pages/Todos.jsx'
import Ledger from './pages/Ledger.jsx'
import Habits from './pages/Habits.jsx'
import News from './pages/News.jsx'
import Study from './pages/Study.jsx'
import English from './pages/English.jsx'
import Weight from './pages/Weight.jsx'
import Review from './pages/Review.jsx'
import AgentChat from './components/AgentChat.jsx'
import { pickByDay } from './lib/dates.js'

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
  { id: 'agent', icon: '🐣', label: '小镇精灵', comp: AgentChat },
]

const TIPS = [
  '完成任务会自动给花园浇水，每天第一次手动浇水免费。',
  '今日 XP 达到 25 / 50 / 80 / 120 时，记得开冒险礼箱！',
  '写一篇复盘 +15 XP，还能点亮心情月历。',
  '答错的单词会自动住进生词本，过两天再翻翻它。',
  '补打卡没有奖励——诚实比连击更珍贵。',
  '月底记得去账本看看「钱都去哪了」。',
  '把明天的第一件事写小一点，小到不可能失败。',
]

export default function App() {
  const { state } = useApp()
  const [page, setPage] = useState('home')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [levelUp, setLevelUp] = useState(null)
  const mainRef = useRef(null)
  const levelRef = useRef(state.profile.level)

  // 音效开关
  useEffect(() => { setMuted(!state.settings.sound) }, [state.settings.sound])

  // 升级检测
  useEffect(() => {
    if (state.profile.level > levelRef.current) {
      setLevelUp(state.profile.level)
      sfx('levelup')
    }
    levelRef.current = state.profile.level
  }, [state.profile.level])

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

  // 页面切换动画
  useGSAP(() => {
    gsap.from('.card', { y: 24, autoAlpha: 0, duration: D(0.42), stagger: 0.055, ease: 'power2.out', clearProps: 'all' })
  }, { dependencies: [page], scope: mainRef, revertOnUpdate: true })

  // 切页回顶部
  useEffect(() => { window.scrollTo({ top: 0 }) }, [page])

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
          <Chip className="wallet" title="金币：完成任务赚，浇水花">🪙 {profile.coins}</Chip>
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
          <PixelSprite name="bird" scale={3} />
        </button>
      )}

      <ToastHost />
      <ConfettiHost />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <LevelUpModal level={levelUp} onClose={() => setLevelUp(null)} />
    </div>
  )
}
