// ---------- App 层的自定义 hooks：从 App.jsx 原样拆出，App 只保留布局与交互 ----------
// 每个 hook 职责单一、可独立测试；改动它们时注意保持与原实现行为一致。
import { useEffect, useRef, useState } from 'react'
import { useApp } from './store.jsx'
import { sfx, emit, emitConfetti } from './gamify.js'
import { CHALLENGES, challengeById, challengeNow } from './challenges.js'
import { ACHIEVEMENTS } from './achievements.js'
import { PLANT_META } from './shop.js'
import { pomoSubscribe, pomoSnap } from './pomo.js'
import { webdavUpload, backupFilename, backupPayload } from './webdav.js'
import { dayKey, addDays, daysBetween, timeOfDay, weekKey } from './dates.js'
import { PAGES } from './nav.js'

// 小镇昼夜：按时段在 body 上打 data-period，天随钟点变（每天只重算分钟级，不需要 React 渲染）
export function useDayPeriod() {
  useEffect(() => {
    const apply = () => { document.body.dataset.period = timeOfDay() }
    apply()
    const t = setInterval(apply, 60000)
    return () => { clearInterval(t); delete document.body.dataset.period }
  }, [])
}

// PWA 安装引导：android = 浏览器给了 beforeinstallprompt（可一键装）；ios = 只能提示手动「添加到主屏幕」
export function usePWA() {
  const [installEvt, setInstallEvt] = useState(null)
  // 安装引导横幅：已安装 / 用户关过的不再出现；iOS 没有 beforeinstallprompt，延迟几秒给手动指引
  const [installUI, setInstallUI] = useState({ show: false, mode: null })

  useEffect(() => {
    const h = (e) => { e.preventDefault(); setInstallEvt(e); setInstallUI({ show: true, mode: 'android' }) }
    window.addEventListener('beforeinstallprompt', h)
    // 安装完成（或浏览器决定不再可安装）→ 关掉引导
    const done = () => { setInstallEvt(null) }
    window.addEventListener('appinstalled', done)
    return () => { window.removeEventListener('beforeinstallprompt', h); window.removeEventListener('appinstalled', done) }
  }, [])

  useEffect(() => {
    const standalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone
    if (standalone()) return
    try { if (localStorage.getItem('pixel-town-install-skip')) return } catch { /* ignore */ }
    const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent || '')
    const t = setTimeout(() => { if (iOS && !installEvt) setInstallUI({ show: true, mode: 'ios' }) }, 4000)
    return () => clearTimeout(t)
  }, [installEvt])

  const dismissBanner = () => {
    try { localStorage.setItem('pixel-town-install-skip', '1') } catch { /* ignore */ }
    setInstallUI({ show: false, mode: null })
  }

  const installApp = async () => {
    if (!installEvt) return
    installEvt.prompt()
    await installEvt.userChoice
    setInstallEvt(null)
    dismissBanner()
  }

  return { installEvt, installUI, installApp, dismissBanner }
}

// WebDAV 自动备份：设置了地址且打开开关后，每天首次访问自动传一份（密钥不入档）。
// 依赖只放「触发条件」字段；备份内容读 ref 里的最新 state——否则每次任意 state 变化都会重跑这个 effect。
export function useAutoBackup() {
  const { state, dispatch } = useApp()
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }) // 每次 commit 后先刷新 ref，备份内容取到的永远是最新 state
  const sent = useRef(null)
  const { autoBackup, webdavUrl, webdavUser, webdavPass } = state.settings
  const lastAutoBackupDay = state.profile.lastAutoBackupDay

  useEffect(() => {
    if (!autoBackup || !webdavUrl || !webdavUser || !webdavPass) return
    if (lastAutoBackupDay === dayKey() || sent.current === dayKey()) return
    sent.current = dayKey()
    const st = stateRef.current
    webdavUpload({
      url: webdavUrl,
      user: webdavUser,
      pass: webdavPass,
      content: JSON.stringify(backupPayload(st)),
      filename: backupFilename(),
    }).then(() => {
      dispatch({ type: 'PROFILE_SET', patch: { lastAutoBackupDay: dayKey() } })
      emit('toast', { icon: '☁️', text: '已自动备份到网盘（含每日留档）' })
    }).catch(() => { sent.current = null }) // 失败不打扰，下次交互再试
  }, [autoBackup, webdavUrl, webdavUser, webdavPass, lastAutoBackupDay, dispatch])
}

// 成就检测：内置 + 自定义计数型，状态变化时跑一遍纯函数判定，解锁的发金币 + 喜报
export function useAchievements() {
  const { state, dispatch } = useApp()
  useEffect(() => {
    const unlocked = state.profile.achievements || {}
    // 稳态早退：全部解锁后，每次 state 变化仍会白跑 16 个判定 → 先花一圈 O(n) 检查还有没有可解锁的
    const remaining = ACHIEVEMENTS.some((a) => !unlocked[a.id])
      || (state.profile.customAch || []).some((c) => c.metric !== 'manual' && !unlocked[c.id])
    if (!remaining) return
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
  }, [state, dispatch]) // eslint-disable-line react-hooks/exhaustive-deps
}

// 每周挑战：周一自动换一个（不重复上周）；本周达成后自动发金币
export function useWeeklyChallenge() {
  const { state, dispatch } = useApp()
  const notify = useNotifier()

  useEffect(() => {
    const wk = weekKey()
    const w = state.profile.weekly || {}
    if (w.week === wk && w.id) return
    const prevId = w.week === addDays(wk, -7) ? w.id : ''
    const pool = CHALLENGES.filter((c) => c.id !== prevId)
    const ch = pool[Math.floor(Math.random() * pool.length)]
    dispatch({ type: 'PROFILE_SET', patch: { weekly: { week: wk, id: ch.id, claimed: false } } })
  }, [state.profile.weekly, dispatch]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const w = state.profile.weekly || {}
    if (!w.id || w.claimed || w.week !== weekKey()) return
    const ch = challengeById(w.id)
    if (ch && challengeNow(ch, state) >= ch.max) {
      dispatch({ type: 'CHALLENGE_CLAIM', coins: ch.coins })
      sfx('levelup')
      emitConfetti(30)
      emit('toast', { icon: ch.icon, text: `本周挑战「${ch.name}」达成！+${ch.coins} 金币` })
      notify(`本周挑战达成 🎉`, `「${ch.name}」完成，${ch.coins} 金币已入库`)
    }
  }, [state, dispatch, notify]) // eslint-disable-line react-hooks/exhaustive-deps
}

// 系统通知：只在用户设置里开了开关且授权后才会弹（soft opt-in，绝不主动打扰）。
// notifyRef 反射最新开关；返回的函数引用稳定，可安全放进 effect 依赖。
export function useNotifier() {
  const { state } = useApp()
  const notifyRef = useRef(state.settings.notify)
  useEffect(() => { notifyRef.current = state.settings.notify }, [state.settings.notify])
  return (title, body) => {
    try {
      if (notifyRef.current && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, tag: 'pomo', icon: 'icon.svg' })
      }
    } catch { /* 通知不可用时静默 */ }
  }
}

// 备份提醒：从没导出过 / 超过 7 天没导出，进首页轻声提一句。
// 依赖 lastExportDay：手动导出后提醒自动停（旧实现空依赖闭包定格，导出后当次会话里还会误提醒）。
export function useBackupNudge(lastExportDay) {
  useEffect(() => {
    if (lastExportDay && daysBetween(lastExportDay, dayKey()) < 7) return
    const timer = setTimeout(() => {
      emit('toast', { icon: '💾', text: '很久没备份啦，去设置「导出备份」放进坚果云同步文件夹，防丢还有云端一份' })
    }, 2500)
    return () => clearTimeout(timer)
  }, [lastExportDay])
}

// 标签页标题：空闲显示当前页；番茄钟进行中显示倒计时（订阅者收到通知时秒数必然已变化，见 pomo.tell）
export function usePageTitle(page) {
  const pageRef = useRef(page)
  useEffect(() => { pageRef.current = page }, [page])
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
}
