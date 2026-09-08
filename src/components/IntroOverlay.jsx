// ---------- 首次启动引导：三步讲清楚「这是什么、怎么玩、找谁帮忙」 ----------
// 只出现一次（localStorage 记过就永不出现），可跳过，不打断任何状态。
import React, { useEffect, useState } from 'react'
import { gsap, D } from '../lib/anim.js'
import { PixelSprite } from '../lib/sprites.jsx'
import { Btn } from './ui.jsx'

const STEPS = [
  { icon: '🏘️', title: '欢迎来到拾光小镇', text: '待办、记账、习惯、学习、复盘都会变成小镇的生机。在这里，每天的进步都看得见。' },
  { icon: '🌱', title: '完成一件事，攒一点生机', text: '每完成一件事都会获得 XP 和金币，还会自动给花园浇水。XP 能开冒险礼箱，金币能买种子和花盆。' },
  { icon: '🐣', title: '阿咕随时陪着你', text: '右下角有个圆滚滚的小精灵。问它「今天还剩几件事」，或直接说「帮我记一条待办：…」。' },
]

export default function IntroOverlay({ onDone }) {
  const [step, setStep] = useState(0)
  useEffect(() => {
    const el = document.querySelector('.intro-overlay')
    if (el) gsap.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: D(0.3), overwrite: true })
  }, [])
  const last = step === STEPS.length - 1
  const s = STEPS[step]
  return (
    <div className="intro-overlay overlay" role="dialog" aria-modal="true" aria-label="拾光小镇快速上手">
      <div className="intro card">
        <PixelSprite name="bloom_sun" scale={5} className="intro-bird" />
        <h2>{s.icon} {s.title}</h2>
        <p>{s.text}</p>
        <div className="intro-dots">{STEPS.map((_, i) => <i key={i} className={i === step ? 'on' : ''} />)}</div>
        <div className="btn-row">
          <Btn onClick={onDone}>跳过</Btn>
          <Btn color="green" onClick={() => (last ? onDone() : setStep(step + 1))}>{last ? '开始小镇生活 🎉' : '下一步'}</Btn>
        </div>
      </div>
    </div>
  )
}