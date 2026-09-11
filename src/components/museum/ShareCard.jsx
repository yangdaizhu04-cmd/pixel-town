import React, { useEffect, useRef } from 'react'
import { Modal, Btn } from '../ui.jsx'
import { ACHIEVEMENTS } from '../../lib/achievements.js'
import { sfx } from '../../lib/gamify.js'
import { dayKey, fmtShort, fmtLong, lastNDays } from '../../lib/dates.js'
import { HEAT, heatIdx } from './heat.js'

// ---------- 分享卡片：像素风画布，可保存成图片 ----------
export default function ShareCard({ state, open, onClose }) {
  const ref = useRef(null)
  const FONT = '"Fusion Pixel 12px Proportional Simplified Chinese","Fusion Pixel 12px Proportional SC",monospace'
  const names = Object.keys(state.profile.achievements || {})
  const totalXp = Object.values(state.xpLog || {}).reduce((m, x) => m + x, 0)
  const t = dayKey()
  const weeks = 4
  const heatDays = lastNDays(weeks * 7, t)

  // 依赖收窄为画布真正读取的字段：以前依赖整个 state，任意页面操作都会整卡重绘
  const { level, streak, coins, achievements, customAch } = state.profile
  const xpLog = state.xpLog
  useEffect(() => {
    if (!open) return
    const run = () => {
      const c = ref.current
      if (!c) return
      const W = 420
      const H = 620
      c.width = W * 2
      c.height = H * 2
      const ctx = c.getContext('2d')
      ctx.scale(2, 2)
      // 纸底 + 像素描边
      ctx.fillStyle = '#fdf6e3'
      ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = '#5b4a38'
      const B = 8
      ctx.fillRect(0, 0, W, B)
      ctx.fillRect(0, H - B, W, B)
      ctx.fillRect(0, 0, B, H)
      ctx.fillRect(W - B, 0, B, H)
      ctx.textAlign = 'center'
      // 标题
      ctx.fillStyle = '#4a3b2a'
      ctx.font = `18px ${FONT}`
      ctx.fillText('拾光小镇 · 我的小镇日志', W / 2, 52)
      ctx.fillStyle = '#8a7a62'
      ctx.font = `12px ${FONT}`
      ctx.fillText(`${fmtLong(t).replace('· ', '')}`, W / 2, 74)
      // 战绩
      ctx.fillStyle = '#4a3b2a'
      ctx.font = `15px ${FONT}`
      const line1 = `Lv.${level}  ·  累计 ${totalXp} XP  ·  连续 ${streak} 天`
      ctx.fillText(line1, W / 2, 118)
      ctx.fillStyle = '#c77c1e'
      ctx.fillText(`🪙 ${coins} 金币  ·  点亮 ${names.length} 枚奖杯`, W / 2, 146)
      // 近一周热力格
      const cell = 12
      const gap = 4
      const gridW = weeks * cell + (weeks - 1) * gap
      const x0 = (W - gridW) / 2
      const y0 = 176
      heatDays.forEach((d, i) => {
        const xp = xpLog?.[d] || 0
        ctx.fillStyle = HEAT[heatIdx(xp)]
        ctx.fillRect(x0 + (i % weeks) * (cell + gap), y0 + Math.floor(i / weeks) * (cell + gap), cell, cell)
      })
      ctx.fillStyle = '#8a7a62'
      ctx.font = `11px ${FONT}`
      ctx.fillText('最近四周的每一天', W / 2, y0 + 4 * (cell + gap) + 14)
      // 最近解锁的三枚奖杯
      const recent = names.slice(-3)
      recent.forEach((id, i) => {
        const ach = [...ACHIEVEMENTS, ...(customAch || [])].find((a) => a.id === id)
        ctx.fillStyle = '#f4e3b8'
        const ry = 240 + i * 52
        ctx.fillRect(40, ry, W - 80, 40)
        ctx.textAlign = 'left'
        ctx.fillStyle = '#4a3b2a'
        ctx.font = `13px ${FONT}`
        ctx.fillText(`${ach?.icon || '🏆'} ${ach?.name || id}`, 56, ry + 17)
        ctx.fillStyle = '#8a7a62'
        ctx.font = `11px ${FONT}`
        ctx.fillText(`${fmtShort(achievements[id])} 达成  ·  +${ach?.coins ?? 0} 金币`, 56, ry + 32)
        ctx.textAlign = 'center'
      })
      // 签名
      ctx.fillStyle = '#8a7a62'
      ctx.font = `13px ${FONT}`
      ctx.fillText('—— 把每天的进步，都种进花园里', W / 2, H - 44)
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(run).catch(run)
    else run()
  }, [open, level, streak, coins, achievements, customAch, xpLog, totalXp, names, heatDays, t]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    const c = ref.current
    if (!c) return
    const a = document.createElement('a')
    a.download = `拾光小镇分享卡-${t}.png`
    a.href = c.toDataURL('image/png')
    a.click()
    sfx('pop')
  }

  return (
    <Modal open={open} onClose={onClose} title="📸 分享卡" wide>
      <div className="share-card-wrap">
        <canvas ref={ref} className="share-card" style={{ width: 420, imageRendering: 'pixelated' }} />
        <p className="muted">像素风分享卡：保存后发到群里，让朋友看看你的小镇有多热闹。</p>
      </div>
      <div className="modal-foot">
        <Btn onClick={onClose}>再改改</Btn>
        <Btn color="green" onClick={save}>💾 保存图片</Btn>
      </div>
    </Modal>
  )
}
