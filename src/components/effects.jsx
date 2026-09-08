import React, { useEffect, useRef, useState } from 'react'
import { gsap, D } from '../lib/anim.js'
import { on, emitConfetti } from '../lib/gamify.js'
import { PixelSprite } from '../lib/sprites.jsx'
import { Modal, Btn } from './ui.jsx'

const PALETTE = ['#79b851', '#f5a742', '#e2695e', '#ffd34e', '#7cc4e8', '#f3b8c6']

// ---------- 冒泡提示 ----------
export function ToastHost() {
  const [items, setItems] = useState([])
  useEffect(() => on('toast', (e) => {
    const id = Math.random().toString(36).slice(2)
    setItems((l) => [...l.slice(-3), { id, ...e.detail }])
  }), [])
  return <div className="toasts" role="status" aria-live="polite">{items.map((t) => <Toast key={t.id} t={t} onDone={() => setItems((l) => l.filter((x) => x.id !== t.id))} />)}</div>
}

function Toast({ t, onDone }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    gsap.fromTo(el, { x: 90, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: D(0.32), ease: 'back.out(1.6)', overwrite: true })
    const timer = setTimeout(() => {
      gsap.to(el, { autoAlpha: 0, y: -10, duration: D(0.25), onComplete: onDone })
    }, 2400)
    return () => { clearTimeout(timer); gsap.killTweensOf(el) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div ref={ref} className="toast">
      <span className="toast-icon">{t.icon}</span>
      <span>{t.text}</span>
    </div>
  )
}

// ---------- 像素彩带 ----------
export function ConfettiHost() {
  useEffect(() => on('confetti', (e) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const n = (e.detail && e.detail.n) || 24
    const x = (e.detail && e.detail.x) ?? window.innerWidth / 2
    const y = (e.detail && e.detail.y) ?? window.innerHeight * 0.32
    for (let i = 0; i < n; i++) {
      const el = document.createElement('div')
      el.className = 'confetti'
      el.style.background = PALETTE[i % PALETTE.length]
      el.style.left = `${x}px`
      el.style.top = `${y}px`
      document.body.appendChild(el)
      const ang = Math.random() * Math.PI * 2
      const dist = 50 + Math.random() * 140
      gsap.to(el, {
        x: Math.cos(ang) * dist,
        y: Math.sin(ang) * dist * 0.6 + 90,
        rotation: Math.random() * 360,
        duration: 0.9 + Math.random() * 0.5,
        ease: 'power2.out',
        onComplete: () => el.remove(),
      })
      gsap.to(el, { autoAlpha: 0, duration: 0.35, delay: 0.95 })
    }
  }), [])
  return null
}

// ---------- 升级弹窗 ----------
export function LevelUpModal({ level, onClose }) {
  useEffect(() => {
    if (level) emitConfetti(42)
  }, [level])
  return (
    <Modal open={!!level} onClose={onClose} title="小镇快讯">
      <div className="levelup">
        <PixelSprite name="bird" scale={7} className="bob" />
        <p className="levelup-big">恭喜升到 Lv.{level}！</p>
        <p className="levelup-tip">小镇响起了礼花声 🎉 主人每天的小进步，阿咕都记在小本本上啦。</p>
        <Btn color="green" onClick={onClose}>太棒了！</Btn>
      </div>
    </Modal>
  )
}
