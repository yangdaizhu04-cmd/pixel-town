import { useEffect, useRef } from 'react'
import { gsap } from './anim.js'

const PAL = {
  green: '#79b851', greenD: '#5c9c46', orange: '#f5a742', blue: '#7cc4e8',
  red: '#e2695e', gold: '#ffd34e', pink: '#f3b8c6', ink: '#4a3b2a', brown: '#8a5a38',
}
export const chartColor = (k) => PAL[k] || k

// 像素柱状图：data = [{ label, value, color? }]
export function Bars({ data, rows = 10, scale = 7, color = 'green', fmt }) {
  const ref = useRef(null)
  const n = data.length
  const max = Math.max(1, ...data.map((d) => d.value))
  const sig = data.map((d) => d.value).join(',')

  useEffect(() => {
    const c = ref.current
    if (!c || !n) return
    c.width = n
    c.height = rows
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, n, rows)
    data.forEach((d, i) => {
      const h = Math.round((d.value / max) * rows)
      if (h > 0) {
        ctx.fillStyle = chartColor(d.color || color)
        ctx.fillRect(i, rows - h, 1, h)
      }
    })
    gsap.killTweensOf(c)
    // 用 fromTo 而不是 from：StrictMode 下 effect 会执行两次，连续 from() 的第二次
    // 会把「被 kill 的中间值」当成终点，柱子会卡在接近 0 的缩放上看不见
    gsap.fromTo(c, { scaleY: 0.001 }, { scaleY: 1, transformOrigin: '50% 100%', duration: 0.6, ease: 'power2.out', overwrite: true })
  }, [sig]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="bars">
      <canvas
        ref={ref}
        className="px-chart"
        style={{ width: n * scale, height: rows * scale, imageRendering: 'pixelated' }}
      />
      {n > 0 && (
        <div className="bars-labels" style={{ gridTemplateColumns: `repeat(${n}, ${scale}px)` }}>
          {data.map((d, i) => (
            <div key={`${d.label}-${i}`} className="bars-label" title={`${d.label}：${fmt ? fmt(d.value) : d.value}`}>
              <span>{d.label}</span>
              <em>{fmt ? fmt(d.value) : d.value}</em>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// 像素折线图：data = [number, ...]
// v2 可选：data2（第二条浅色曲线，如 7 日均值）、goal（水平虚线，如目标体重）。
// min/max 由三条线共同决定，否则目标线会把主曲线压扁。
export function Line({ data, data2, goal, rows = 14, scale = 8, color = 'orange', color2 = 'blue' }) {
  const ref = useRef(null)
  const n = data.length
  const sig = [data.join(','), (data2 || []).join(','), goal ?? ''].join('|')

  useEffect(() => {
    const c = ref.current
    if (!c || n < 2) return
    const all = [...data, ...(data2 || []), ...(goal != null ? [goal] : [])]
    const min = Math.min(...all)
    const max = Math.max(...all)
    const span = Math.max(0.001, max - min)
    c.width = n
    c.height = rows
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, n, rows)
    const yOf = (v) => Math.max(0, Math.min(rows - 1, Math.round(rows - 1.5 - ((v - min) / span) * (rows - 3))))
    const drawSeries = (series, col) => {
      if (!series || series.length < 2) return
      const pts = series.map((v, i) => [i, yOf(v)])
      for (let i = 0; i < series.length - 1; i++) {
        const [x0, y0] = pts[i]
        const [_x1, y1] = pts[i + 1]
        const steps = Math.max(1, Math.abs(y1 - y0))
        for (let t = 0; t <= steps; t++) {
          const x = x0
          const y = Math.round(y0 + ((y1 - y0) * t) / steps)
          ctx.fillStyle = col
          ctx.fillRect(x, y, 1, 1)
        }
      }
      pts.forEach(([x, y]) => {
        ctx.fillStyle = col
        ctx.fillRect(x, y, 1, 1)
      })
    }
    // 目标线：隔两格一点的虚线
    if (goal != null) {
      const y = yOf(goal)
      ctx.fillStyle = chartColor('greenD')
      for (let x = 0; x < n; x += 3) ctx.fillRect(x, y, 2, 1)
    }
    if (data2 && data2.length >= 2) drawSeries(data2, chartColor(color2))
    drawSeries(data, chartColor(color))
    gsap.killTweensOf(c)
    gsap.fromTo(c, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, overwrite: true })
  }, [sig]) // eslint-disable-line react-hooks/exhaustive-deps

  if (n < 2) return <div className="chart-empty">数据还不够，先记录两次吧 🌱</div>
  return (
    <canvas
      ref={ref}
      className="px-chart"
      style={{ width: n * scale, height: rows * scale, imageRendering: 'pixelated' }}
    />
  )
}
