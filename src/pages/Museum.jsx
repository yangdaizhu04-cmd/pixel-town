import React, { useEffect, useRef, useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { Panel, Modal, Btn, Bar, Field, Empty, confirmBox } from '../components/ui.jsx'
import { PixelSprite } from '../lib/sprites.jsx'
import { ACHIEVEMENTS, ACH_METRICS, metricOf, customValue, customDesc } from '../lib/achievements.js'
import { PLANT_META } from '../lib/shop.js'
import { sfx, emit } from '../lib/gamify.js'
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

// ---------- 成就墙（内置 + 自定义） ----------
function TrophyWall({ state, onClaim, onDel }) {
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

// ---------- 新建自定义成就 ----------
function CustomAchModal({ open, onClose }) {
  const { dispatch } = useApp()
  const [name, setName] = useState('')
  const [metric, setMetric] = useState('todosDone')
  const [target, setTarget] = useState(10)
  const [coins, setCoins] = useState(10)

  const add = () => {
    const n = name.trim()
    if (!n) return
    if (metric !== 'manual' && target < 1) return
    dispatch({
      type: 'ACH_CUSTOM_ADD',
      meta: {
        name: n,
        metric,
        target: metric === 'manual' ? 0 : Math.max(1, Math.round(target)),
        coins: Math.max(0, Math.min(60, Math.round(coins))),
      },
    })
    sfx('pop')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="🎯 自定义成就">
      <div className="field-stack">
        <Field label="成就名称（想庆祝的那件事）">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：读完 10 本书" autoFocus />
        </Field>
        <Field label="达成方式">
          <select value={metric} onChange={(e) => setMetric(e.target.value)}>
            {ACH_METRICS.map((m) => <option key={m.id} value={m.id}>{m.icon} {m.label}</option>)}
            <option value="manual">🕯️ 手动点亮（自己的心愿）</option>
          </select>
        </Field>
        {metric !== 'manual' && (
          <Field label="目标值">
            <input type="number" min={1} value={target} onChange={(e) => setTarget(Number(e.target.value))} />
          </Field>
        )}
        <Field label="解锁奖励金币（0-60）">
          <input type="number" min={0} max={60} value={coins} onChange={(e) => setCoins(Number(e.target.value))} />
        </Field>
        <p className="muted">计数型成就达到目标会自动解锁；手动心愿则由你亲手点亮。</p>
      </div>
      <div className="modal-foot">
        <Btn onClick={onClose}>再想想</Btn>
        <Btn color="green" onClick={add} disabled={!name.trim()}>建立成就</Btn>
      </div>
    </Modal>
  )
}

export default function Museum() {
  const { state, dispatch } = useApp()
  const [achOpen, setAchOpen] = useState(false)
  const totalXp = Object.values(state.xpLog || {}).reduce((m, x) => m + x, 0)
  const customAch = state.profile.customAch || []
  const achCount = Object.keys(state.profile.achievements || {}).length

  const claim = async (a) => {
    if (await confirmBox({ title: '点亮心愿', message: `点亮「${a.name}」拿 ${a.coins} 金币？\n点亮后不可撤销（宽恕优先，想反悔就再建一个 😉）` })) {
      dispatch({ type: 'ACH_UNLOCK', id: a.id, coins: a.coins })
      sfx('coin')
      emit('toast', { icon: '🏆', text: `点亮成就「${a.name}」！+${a.coins} 金币` })
    }
  }

  const del = async (a) => {
    if (await confirmBox({ title: '删除自定义成就', message: `删除「${a.name}」？解锁记录也会一起清掉`, danger: true, okText: '删除' })) {
      dispatch({ type: 'ACH_CUSTOM_DEL', id: a.id })
      sfx('oops')
    }
  }

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
        extra={
          <div className="btn-row">
            <span className="xp-pill">{achCount} / {ACHIEVEMENTS.length + customAch.length} 枚奖杯</span>
            <Btn size="sm" color="gold" onClick={() => setAchOpen(true)}>＋ 自定义成就</Btn>
          </div>
        }
      >
        <TrophyWall state={state} onClaim={claim} onDel={del} />
      </Panel>

      <CustomAchModal open={achOpen} onClose={() => setAchOpen(false)} />
    </>
  )
}