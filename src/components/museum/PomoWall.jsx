import React, { useMemo } from 'react'
import { PixelSprite } from '../../lib/sprites.jsx'
import { Empty } from '../ui.jsx'
import { lastNDays, fmtShort } from '../../lib/dates.js'

// ---------- 专注番茄田（每完成一个番茄钟，墙里就多一颗番茄） ----------
export default function PomoWall({ state }) {
  const log = state.pomoLog || []
  const days = lastNDays(28)
  // 分组只随 pomoLog 变化重算；墙上最多 28 格 × 5 颗精灵，别在每次渲染时重建
  const byDay = useMemo(() => {
    const m = {}
    for (const p of state.pomoLog || []) { (m[p.t] ||= []).push(p) }
    return m
  }, [state.pomoLog])
  const totalMin = log.reduce((m, p) => m + (p.min || 0), 0)
  const hours = Math.round((totalMin / 60) * 10) / 10

  if (!log.length) {
    return <Empty icon="🍅">还没种下番茄。去「学习计划」页开始一段专注，完成后这里会长出第一颗。</Empty>
  }
  return (
    <>
      <div className="pomo-wall">
        {days.map((d) => {
          const list = byDay[d]
          const n = list ? Math.min(list.length, 5) : 0
          const more = list ? list.length - n : 0
          return (
            <div key={d} className={`pw-cell ${list ? 'on' : ''}`} title={list ? `${fmtShort(d)} · ${list.length} 颗番茄` : fmtShort(d)}>
              {Array.from({ length: n }, (_, i) => <PixelSprite key={i} name="tomato" scale={1} />)}
              {list && more > 0 && <span className="pw-n">+{more}</span>}
              {!list && <span className="pw-n">·</span>}
            </div>
          )
        })}
      </div>
      <p className="muted">一格是一天：累计 {log.length} 颗番茄 · 约 {hours} 小时专注。种满 50 颗会解锁成就「番茄田」哦。</p>
    </>
  )
}
