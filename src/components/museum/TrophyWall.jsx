import React from 'react'
import { Btn, Bar } from '../ui.jsx'
import { ACHIEVEMENTS, metricOf, customValue, customDesc } from '../../lib/achievements.js'
import { fmtShort } from '../../lib/dates.js'

// ---------- 成就墙（内置 + 自定义） ----------
export default function TrophyWall({ state, onClaim, onDel }) {
  const unlocked = state.profile.achievements || {}
  const custom = state.profile.customAch || []
  return (
    <div className="ach-grid">
      {ACHIEVEMENTS.map((a) => {
        const day = unlocked[a.id]
        return (
          <div key={a.id} className={`ach-item card ${day ? 'on' : 'dim'}`} title={a.desc}>
            <span className="ach-icon">{day ? a.icon : '🔒'}</span>
            <div className="ach-info">
              <b>{a.name}</b>
              <span>{day ? `${fmtShort(day)} 达成 · +${a.coins} 🪙` : a.desc}</span>
            </div>
          </div>
        )
      })}
      {custom.map((a) => {
        const day = unlocked[a.id]
        const m = metricOf(a.metric)
        const val = customValue(a, state)
        const isManual = a.metric === 'manual'
        return (
          <div key={a.id} className={`ach-item card cust ${day ? 'on' : 'dim'}`} title={customDesc(a)}>
            <span className="ach-icon">{day ? (m?.icon || '🕯️') : '🔒'}</span>
            <div className="ach-info">
              <b>
                <span className="ach-name">{a.name}</span>
                {day === undefined && isManual && (
                  <span className="ach-marks">
                    <Btn size="xs" color="green" onClick={() => onClaim(a)}>点亮</Btn>
                  </span>
                )}
                <button className="del" title="删除自定义成就" onClick={() => onDel(a)}>×</button>
              </b>
              <span>
                {day ? `${fmtShort(day)} 达成 · +${a.coins} 🪙` : `${customDesc(a)} · +${a.coins} 🪙`}
              </span>
              {!day && !isManual && (
                <Bar pct={(val / Math.max(1, a.target)) * 100} color="green" className="ach-progress" />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
