// ---------- 阿咕随机闪现：偶尔从角落蹦出来说句暖话，然后自己飘走 ----------
// 频率克制：最短 3 分钟一见、约 55% 概率现身、每次 9 秒；开屏/切页不打扰。
import React, { useEffect, useRef, useState } from 'react'
import { useApp, todosOpen } from '../lib/store.jsx'
import { gsap, D } from '../lib/anim.js'
import { PixelSprite } from '../lib/sprites.jsx'

const VISITS = [
  '咕咕！今天也辛苦了～',
  '花园里有点缺水，去浇一下？💧',
  '记得轻轻伸个懒腰再继续 ☀️',
  '阿咕在看着你发光 ✨',
  '番茄钟在等一位专注的大人 🍅',
  '镇子今天也很热闹，因为有你在 🏘️',
  '遇到难事就拆成小石子，一颗一颗踢 ✨',
]

export default function AguVisit({ onGoChat }) {
  const { state } = useApp()
  const [vis, setVis] = useState(null)
  const ref = useRef(null)
  const doneAt = useRef(0)
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])

  // 巡视：每分钟看一次，满足冷却且抽中才现身
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => {
      const now = Date.now()
      if (now - doneAt.current < 3 * 60000) return
      if (Math.random() > 0.55) return
      doneAt.current = now
      const s = stateRef.current
      const open = todosOpen(s)
      const texts = open.length
        ? [`今天还剩 ${open.length} 件小事，一件一件来～`, ...VISITS]
        : [...VISITS, '今天的事情做完啦，去首页开奖箱吧 🎁']
      setVis({ text: texts[Math.floor(Math.random() * texts.length)] })
    }, 60000)
    return () => clearInterval(t)
  }, [])

  // 现身动画 + 9 秒后飘走
  useEffect(() => {
    if (!vis || !ref.current) return
    const el = ref.current
    gsap.fromTo(el, { x: -90, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: D(0.4), ease: 'back.out(1.6)', overwrite: true })
    const timer = setTimeout(() => {
      gsap.to(el, { y: -16, autoAlpha: 0, duration: D(0.35), onComplete: () => setVis(null) })
    }, 9000)
    return () => { clearTimeout(timer); gsap.killTweensOf(el) }
  }, [vis]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!vis) return null
  return (
    <button ref={ref} className="agu-visit" onClick={onGoChat} aria-label={`阿咕：${vis.text}。点我找阿咕聊天`}>
      <PixelSprite name="bird" scale={2} className="agu-visit-bird" />
      <span className="agu-visit-bubble">{vis.text}</span>
    </button>
  )
}