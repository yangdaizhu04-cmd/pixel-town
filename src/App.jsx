import React, { useEffect, useRef, useState } from 'react'
import { useApp } from './lib/store.jsx'
import { gsap, useGSAP, D } from './lib/anim.js'
import { sfx, setMuted, xpNeeded, emit, on, reward } from './lib/gamify.js'
import { PixelSprite } from './lib/sprites.jsx'
import { Chip, Btn, Bar, ConfirmHost } from './components/ui.jsx'
import { ToastHost, ConfettiHost, LevelUpModal } from './components/effects.jsx'
import SettingsModal from './components/SettingsModal.jsx'
import CommandPalette from './components/CommandPalette.jsx'
import { pomoSubscribe, pomoStartBreak, pomoSnap } from './lib/pomo.js'
import { dayKey, pickByDay } from './lib/dates.js'
import { fetchPoem } from './lib/poem.js'
import { PAGES, HOTKEYS, TIPS, SHORT } from './lib/nav.js'
import {
  useDayPeriod, usePWA, useAutoBackup, useAchievements,
  useWeeklyChallenge, useBackupNudge, usePageTitle, useNotifier,
} from './lib/hooks.js'
import AgentChat, { BirdAvatar } from './components/AgentChat.jsx'
import AguVisit from './components/AguVisit.jsx'
import IntroOverlay from './components/IntroOverlay.jsx'
import NightSky from './components/NightSky.jsx'
import FocusAmbience from './components/FocusAmbience.jsx'

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
  const [cmdkOpen, setCmdkOpen] = useState(false)
  const [levelUp, setLevelUp] = useState(null)
  // 每日诗词（今日题词）：poem.js 内部按日期缓存 + in-flight 去重，这里只负责把结果接进来
  const [poem, setPoem] = useState(null)
  // 首次启动引导：只在没标记过时弹一次（localStorage 记忆）
  const [showIntro, setShowIntro] = useState(() => {
    try { return !localStorage.getItem('pixel-town-seen-intro') } catch { return true }
  })
  // 安装引导 / 昼夜 / 备份 / 成就 / 周挑战 / 标题：全部收进独立 hooks（见 lib/hooks.js）
  const { installEvt, installUI, installApp, dismissBanner } = usePWA()
  useDayPeriod()
  useAutoBackup()
  useAchievements()
  useWeeklyChallenge()
  usePageTitle(page)
  useBackupNudge(state.profile.lastExportDay)
  const notify = useNotifier()
  const mainRef = useRef(null)
  const levelRef = useRef(state.profile.level)
  // 触屏滑动切页
  const touchX = useRef(null)

  // 音效开关
  useEffect(() => { setMuted(!state.settings.sound) }, [state.settings.sound])

  const closeIntro = () => {
    try { localStorage.setItem('pixel-town-seen-intro', '1') } catch { /* ignore */ }
    setShowIntro(false)
  }

  // 每日诗词：首屏拉一次即可（poem.js 内部按日缓存 + in-flight 去重，跨天重新挂载会自动换新）
  useEffect(() => {
    let alive = true
    fetchPoem(dayKey()).then((p) => { if (alive) setPoem(p) }).catch(() => {})
    return () => { alive = false }
  }, [])

  const onTouchStart = (e) => { touchX.current = e.touches[0].clientX }
  const onTouchEnd = (e) => {
    if (touchX.current == null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    touchX.current = null
    const tag = (e.target.tagName || '').toLowerCase()
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return
    if (Math.abs(dx) < 50) return
    const i = PAGES.findIndex((p) => p.id === page)
    const next = dx < 0 ? i + 1 : i - 1
    if (next >= 0 && next < PAGES.length) { sfx('click'); setPage(PAGES[next].id) }
  }

  // 番茄钟完成：专注轮 → 记时长发奖励并自动接休息轮；休息轮 → 只提醒不奖励（休息不该被 KPI 化）
  useEffect(() => on('pomo-done', ({ detail }) => {
    const { min, planId, mode } = detail || {}
    sfx('alarm')
    if (mode === 'break') {
      emit('toast', { icon: '☀️', text: '休息完毕！准备好就开始下一个番茄吧' })
      notify('休息完毕 ☕', '阿咕提醒你：休息够了，准备好就开始下一个番茄吧')
      return
    }
    notify('专注完成 🍅', `专注 ${min} 分钟拿下！去休息一下，阿咕替你看着钟`)
    dispatch({ type: 'POMO_DONE', min, planId, h: new Date().getHours() })
    const xp = Math.min(30, Math.max(5, Math.round((min / 30) * 10)))
    const coins = min >= 30 ? 3 : 1
    reward(dispatch, { xp, coins, msg: `专注 ${min} 分钟`, icon: '🍅', confetti: true })
    pomoStartBreak()
    emit('toast', { icon: '☕', text: `休息 ${pomoSnap().total / 60} 分钟，阿咕替你看着钟` })
  }), [dispatch, notify]) // dispatch/notify 引用稳定，监听器只注册一次

  // 升级检测
  useEffect(() => {
    if (state.profile.level > levelRef.current) {
      setLevelUp(state.profile.level)
      sfx('levelup')
    }
    levelRef.current = state.profile.level
  }, [state.profile.level])

  // 键盘快捷键：Ctrl/Cmd+K 快速输入（任何位置可用，优先级最高）；数字键切页（输入框/弹窗打开时不劫持）
  useEffect(() => {
    const onCmdK = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        sfx('pop')
        setCmdkOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onCmdK)
    return () => window.removeEventListener('keydown', onCmdK)
  }, [])
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

  const { profile } = state
  const need = xpNeeded(profile.level)
  const Cur = PAGES.find((p) => p.id === page).comp

  return (
    <div className="app">
      <div className="sky" aria-hidden="true">
        <NightSky />
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
          <Chip className="lv" title={`距下一级还差 ${Math.max(0, need - profile.xp)} XP`}>Lv.{profile.level} <em className="lv-xp">{profile.xp}/{need} XP</em></Chip>
          <Chip className="wallet" title="金币：完成任务赚，商店和浇水花">🪙 {profile.coins}</Chip>
          <Btn size="sm" title="快速输入（Ctrl+K）：记待办 / 记账 / 搜索 / 跳页" onClick={() => setCmdkOpen(true)}>⌘K</Btn>
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
            {poem && (
              <div className="elder-poem">
                <span className="elder-poem-mark">📜 今日题词{poem.source === 'fallback' ? ' · 离线精选' : ''}</span>
                <p className="elder-poem-text">{poem.text}</p>
                <span className="elder-poem-src">{poem.dynasty && `${poem.dynasty}·`}{poem.author}{poem.title && `《${poem.title}》`}</span>
              </div>
            )}
          </div>
        </aside>

        <main className="page" ref={mainRef} key={page} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {page === 'agent'
            ? <AgentChat onOpenSettings={() => setSettingsOpen(true)} />
            : <Cur />}
        </main>
      </div>

      {page !== 'agent' && (
        <button className="fab" title="和阿咕聊聊" aria-label="和阿咕聊聊" onClick={() => { sfx('pop'); setPage('agent') }}>
          <BirdAvatar scale={3} />
        </button>
      )}
      <PomoBadge onGo={() => { sfx('click'); setPage('study') }} />
      {page !== 'agent' && <AguVisit onGoChat={() => { sfx('pop'); setPage('agent') }} />}

      {/* 安装引导：可一键安装时给按钮，iOS 只给手动指引；可关闭、装过/关过不再出现 */}
      {installUI.show && (
        <div className="install-banner" role="note" aria-label="安装提示">
          <span className="install-banner-icon">{installUI.mode === 'android' ? '📱' : '🧭'}</span>
          <p className="install-banner-text">
            {installUI.mode === 'android'
              ? '把小城镇装进手机桌面，离线也能打开～'
              : '想当 App 用？点浏览器分享按钮，选「添加到主屏幕」～'}
          </p>
          {installUI.mode === 'android' && <Btn size="sm" color="green" onClick={installApp}>安装 App</Btn>}
          <button className="install-banner-x" aria-label="关闭安装提示" onClick={dismissBanner}>×</button>
        </div>
      )}

      {/* 移动端底部导航（窄屏显示） */}
      <nav className="bottom-nav" aria-label="页面导航">
        {PAGES.map((p) => (
          <button
            key={p.id}
            className={`nav-item ${page === p.id ? 'active' : ''}`}
            aria-current={page === p.id ? 'page' : undefined}
            onClick={() => { if (page !== p.id) { sfx('click'); setPage(p.id) } }}
          >
            <span className="nav-icon">{p.icon}</span>
            <span className="nav-text">{SHORT[p.id]}</span>
          </button>
        ))}
      </nav>

      <FocusAmbience />
      <ToastHost />
      <ConfettiHost />
      <ConfirmHost />
      {showIntro && <IntroOverlay onDone={closeIntro} />}
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} installable={!!installEvt} onInstall={installApp} />
      <CommandPalette open={cmdkOpen} onClose={() => setCmdkOpen(false)} onGo={(id) => { if (page !== id) setPage(id) }} />
      <LevelUpModal level={levelUp} onClose={() => setLevelUp(null)} />
    </div>
  )
}
