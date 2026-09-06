import React, { useEffect, useRef } from 'react'
import { useApp } from '../lib/store.jsx'
import { Panel, Empty } from '../components/ui.jsx'
import { PixelSprite } from '../lib/sprites.jsx'
import { ACHIEVEMENTS } from '../lib/achievements.js'
import { PLANT_META } from '../lib/shop.js'
import { dayKey, addDays, parseKey, fmtShort } from '../lib/dates.js'

// ---------- XP 热力图（26 周，GitHub 贡献图的小镇版） ----------
const HEAT = ['#efe3c4', '#cfe8b8', '#a8d78d', '#79b851', '#ffd34e']
const heatIdx = (xp) => (xp <= 0 ? 0 : xp < 30 ? 1 : xp < 60 ? 2 : xp < 90 ? 3 : 4)

function Heatmap({ xpLog }) {
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

// ---------- 植物图鉴 ----------
function Collection({ state }) {
  const { collection = [], unlockedKinds = [] } = state.profile
  return (
    <div className="dex-grid">
      {PLANT_META.map((p) => {
        const bloomed = collection.includes(p.id)
        const unlocked = unlockedKinds.includes(p.id)
        return (
          <div key={p.id} className={`dex-item card ${bloomed ? '' : 'dim'}`}>
            <PixelSprite name={bloomed ? `bloom_${p.id}` : unlocked ? 'p3' : 'pot_empty'} scale={4} className={bloomed ? '' : 'dim'} />
            <b>{unlocked ? p.name : '？？？'}</b>
            <span className="dex-note">{bloomed ? '已盛开 ✓' : unlocked ? '种下后等你养到盛开' : '商店里有它的种子'}</span>
          </div>
        )
      })}
    </div>
  )
}

// ---------- 成就墙 ----------
function TrophyWall({ state }) {
  const unlocked = state.profile.achievements || {}
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
    </div>
  )
}

export default function Museum() {
  const { state } = useApp()
  const totalXp = Object.values(state.xpLog || {}).reduce((m, x) => m + x, 0)
  const achCount = Object.keys(state.profile.achievements || {}).length

  return (
    <>
      <Panel
        title="小镇半年鉴" icon="🗺️"
        extra={<span className="xp-pill">历史累计 {totalXp} XP</span>}
      >
        <p className="muted">每一格是一天：颜色越亮，那天的小镇越热闹。金色是冲破 90 XP 的日子！</p>
        <Heatmap xpLog={state.xpLog} />
      </Panel>

      <Panel
        title="植物图鉴" icon="🌻"
        extra={<span className="xp-pill">{(state.profile.collection || []).length} / {PLANT_META.length} 收集</span>}
      >
        {(state.profile.collection || []).length === 0
          ? <Empty icon="🌱">还没有植物盛开。完成任务会自动浇水，盛开的那一刻会记在这里。</Empty>
          : <Collection state={state} />}
      </Panel>

      <Panel
        title="成就奖杯墙" icon="🏆"
        extra={<span className="xp-pill">{achCount} / {ACHIEVEMENTS.length} 枚奖杯</span>}
      >
        <TrophyWall state={state} />
      </Panel>
    </>
  )
}
