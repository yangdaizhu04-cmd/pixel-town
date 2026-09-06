import React, { useState } from 'react'
import { useApp, lastWeight, bmiOf } from '../lib/store.jsx'
import { Panel, Btn, Chip, Empty } from '../components/ui.jsx'
import { Line } from '../lib/charts.jsx'
import { REWARDS, reward, sfx, emit } from '../lib/gamify.js'
import { dayKey, fmtShort } from '../lib/dates.js'

export default function Weight() {
  const { state, dispatch } = useApp()
  const [kg, setKg] = useState('')
  const t = dayKey()
  const latest = lastWeight(state)
  const prev = state.weights.length > 1 ? state.weights[state.weights.length - 2] : null
  const delta = latest && prev ? +(latest.kg - prev.kg).toFixed(1) : null
  const bmi = bmiOf(state)
  const loggedToday = state.weights.some((x) => x.day === t)

  const first = state.weights[0]
  const lost = first ? +(first.kg - (latest ? latest.kg : first.kg)).toFixed(1) : 0

  const save = () => {
    const v = Math.round(+kg * 10) / 10
    if (!v || v < 20 || v > 300) return
    const isNew = !loggedToday
    dispatch({ type: 'WEIGHT_ADD', day: t, kg: v })
    setKg('')
    sfx('check')
    if (isNew) reward(dispatch, { ...REWARDS.weight, msg: '体重已记录', icon: '⚖️' })
    else emitToast('已更新今天的体重')
  }

  const bmiLabel = bmi == null ? '' : bmi < 18.5 ? '偏轻' : bmi < 24 ? '正好' : bmi < 28 ? '偏重' : '该动动了'

  return (
    <>
      <div className="stat-grid three">
        <div className="card stat">
          <span className="stat-icon">⚖️</span>
          <div className="stat-num">{latest ? `${latest.kg}kg` : '--'}</div>
          <div className="stat-label">最新体重</div>
          {delta !== null && <div className="stat-sub">{delta === 0 ? '和上次持平' : delta < 0 ? `比上次轻了 ${-delta}kg 🎉` : `比上次重了 ${delta}kg`}</div>}
        </div>
        <div className="card stat">
          <span className="stat-icon">🧮</span>
          <div className="stat-num">{bmi ?? '--'}</div>
          <div className="stat-label">BMI {bmiLabel && `· ${bmiLabel}`}</div>
          <div className="stat-sub">{state.profile.height ? `身高 ${state.profile.height}cm` : '设置里填身高后自动计算'}</div>
        </div>
        <div className="card stat">
          <span className="stat-icon">🏅</span>
          <div className="stat-num">{state.weights.length}</div>
          <div className="stat-label">累计记录（天）</div>
          {first && <div className="stat-sub">{lost > 0 ? `比最初轻了 ${lost}kg！` : lost < 0 ? `比最初重了 ${-lost}kg` : '和最初持平'}</div>}
        </div>
      </div>

      <Panel title="记录今天" icon="📝" extra={loggedToday && <Chip color="green">今天已记录 ✓</Chip>}>
        <div className="add-row">
          <input
            type="number"
            step="0.1"
            placeholder="体重 kg，比如 63.5"
            value={kg}
            onChange={(e) => setKg(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save() }}
          />
          <Btn color="green" onClick={save}>＋ 上秤！</Btn>
        </div>
        <p className="muted">数字只是参考，好好吃饭、好好睡觉比什么都重要 🌙</p>
      </Panel>

      <Panel title="体重曲线" icon="📉">
        <Line data={state.weights.slice(-21).map((x) => x.kg)} rows={14} scale={12} color="orange" />
        {state.weights.length > 1 && (
          <div className="line-legend">
            <span>{fmtShort(state.weights[Math.max(0, state.weights.length - 21)].day)} → {fmtShort(latest.day)}</span>
          </div>
        )}
      </Panel>

      <Panel title="记录历史" icon="🗂️">
        {state.weights.length === 0 ? (
          <Empty icon="⚖️">还没有记录。今天上一次秤，就是最好的开始。</Empty>
        ) : (
          <ul className="weight-list">
            {[...state.weights].reverse().slice(0, 14).map((x, i, arr) => {
              const d = i < arr.length - 1 ? +(x.kg - arr[i + 1].kg).toFixed(1) : null
              return (
                <li key={x.day} className="weight-item">
                  <span className="weight-day">{x.day === t ? '今天' : fmtShort(x.day)}</span>
                  <b>{x.kg} kg</b>
                  {d !== null && <Chip color={d < 0 ? 'green' : d > 0 ? 'red' : ''}>{d === 0 ? '—' : d < 0 ? `↓${-d}` : `↑${d}`}</Chip>}
                  <button className="del" title="删除" onClick={() => { dispatch({ type: 'WEIGHT_DEL', day: x.day }); sfx('oops') }}>×</button>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>
    </>
  )
}

function emitToast(text) {
  emit('toast', { icon: '⚖️', text })
}
