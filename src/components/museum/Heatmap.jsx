import React, { useEffect, useRef } from 'react'
import { dayKey, addDays, parseKey } from '../../lib/dates.js'
import { HEAT, heatIdx } from './heat.js'

// ---------- XP 热力图（26 周，GitHub 贡献图的小镇版） ----------
export default function Heatmap({ xpLog }) {
  const ref = useRef(null)
  const scale = 11
  const weeks = 26
  const t = dayKey()
  const days = Array.from({ length: weeks * 7 }, (_, i) => addDays(t, -(weeks * 7 - 1 - i)))
  // 第一格对齐到周日
  const pad = parseKey(days[0]).getDay()
  const cells = [...Array(pad).fill(null), ...days.map((d) => ({ d, xp: xpLog?.[d] || 0 }))]
  while (cells.length % 7 !== 0) cells.push(null)
  const cols = cells.length / 7
  const sig = days.map((d) => xpLog?.[d] || 0).join(',') + t

  useEffect(() => {
    const c = ref.current
    if (!c) return
    c.width = cols
    c.height = 7
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, cols, 7)
    cells.forEach((cell, i) => {
      if (!cell) return
      ctx.fillStyle = HEAT[heatIdx(cell.xp)]
      ctx.fillRect(Math.floor(i / 7), i % 7, 1, 1)
    })
  }, [sig]) // eslint-disable-line react-hooks/exhaustive-deps

  const total = days.reduce((m, d) => m + (xpLog?.[d] || 0), 0)

  return (
    <div className="heatmap-wrap">
      <canvas
        ref={ref}
        className="px-chart"
        style={{ width: cols * scale, height: 7 * scale, imageRendering: 'pixelated' }}
      />
      <div className="heatmap-legend">
        <span>半年共 {total} XP</span>
        <span className="heat-keys">
          安静
          {HEAT.map((h) => <i key={h} style={{ background: h }} />)}
          燃
        </span>
      </div>
    </div>
  )
}
