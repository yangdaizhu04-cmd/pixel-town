import React, { useEffect, useState } from 'react'
import { useApp, studyDone } from '../lib/store.jsx'
import { Panel, Btn, Bar, Empty, Chip, Field, confirmBox } from '../components/ui.jsx'
import { Bars } from '../lib/charts.jsx'
import { PixelSprite } from '../lib/sprites.jsx'
import { reward, sfx, emit } from '../lib/gamify.js'
import { pomoSubscribe, pomoStart, pomoPause, pomoResume, pomoReset, pomoStop } from '../lib/pomo.js'
import { dayKey, lastNDays, fmtShort, daysBetween, WEEKDAYS } from '../lib/dates.js'

const POMO_MINS = [15, 25, 45, 60]
const fmtClock = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`

function Pomodoro() {
  const { state } = useApp()
  const [min, setMin] = useState(25)
  const [minText, setMinText] = useState('25') // 输入框独立文本态：打字过程不被 clamp 打断
  const [planId, setPlanId] = useState('')
  const [pomo, setPomo] = useState(null)

  useEffect(() => pomoSubscribe(setPomo), [])

  const running = pomo?.running
  const left = pomo?.left ?? min * 60
  const started = pomo && (pomo.left !== pomo.total || running)

  const pickMin = (m) => {
    setMin(m)
    setMinText(String(m))
    if (!running) pomoReset(m, planId)
    sfx('click')
  }
  // 自定义时长：合法范围 1-180 分钟，空闲时同步重置时钟
  const typeMin = (text) => {
    setMinText(text)
    const v = Math.round(+text)
    if (v >= 1 && v <= 180) {
      setMin(v)
      if (!running && !started) pomoReset(v, planId)
    }
  }

  return (
    <Panel
      title="像素番茄钟" icon="🍅"
      extra={state.study.length > 0 && (
        <select value={planId} onChange={(e) => setPlanId(e.target.value)}>
          <option value="">自由专注（不挂计划）</option>
          {state.study.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      )}
    >
      <div className="pomo">
        <div className={`pomo-clock card ${running ? 'on' : ''}`}>
          {running && <PixelSprite name="bird" scale={3} className="bob pomo-bird" />}
          <span className="pomo-time">{fmtClock(left)}</span>
          <span className="pomo-hint">
            {running ? (planId ? '专注中…完成后自动记进计划' : '专注中…阿咕陪着你') : started ? '暂停中，歇会也行' : '选好时长，开始一段专注'}
          </span>
        </div>
        <div className="pomo-ctrl">
          <div className="pomo-set">
            <div className="seg">
              {POMO_MINS.map((m) => (
                <button key={m} className={min === m ? 'on' : ''} disabled={running} onClick={() => pickMin(m)}>{m} 分</button>
              ))}
            </div>
            <input
              type="number" min="1" max="180" className="pomo-custom"
              value={minText}
              disabled={running}
              title="自定义时长，1-180 分钟"
              onChange={(e) => typeMin(e.target.value)}
            />
            <span className="pomo-custom-unit">分钟</span>
          </div>
          <div className="btn-row">
            {!running
              ? <Btn color="green" onClick={() => { if (started) pomoResume(); else { pomoStart(min, planId); emit('toast', { icon: '🍅', text: `番茄钟出发！接下来 ${min} 分钟属于你` }) } }}>{started ? '继续 ▶' : `开始专注 ▶（${min} 分）`}</Btn>
              : <Btn color="gold" onClick={() => pomoPause()}>暂停 ⏸</Btn>}
            <Btn onClick={() => { pomoReset(min, planId); setMinText(String(min)) }}>重置 ↻</Btn>
            {started && <Btn color="red" onClick={() => pomoStop()}>放弃</Btn>}
          </div>
          <p className="muted">时长可以自己定（1-180 分钟）；中途切去别的页面它也会继续走；完成时自动记时长、发 XP，阿咕会喊你回来。</p>
        </div>
      </div>
    </Panel>
  )
}

export default function Study() {
  const { state, dispatch } = useApp()
  const [title, setTitle] = useState('')
  const [targetH, setTargetH] = useState(10)
  const [deadline, setDeadline] = useState('')
  const [logging, setLogging] = useState(null) // 正在记录的 plan id
  const [min, setMin] = useState(25)
  const [note, setNote] = useState('')

  const t = dayKey()
  const week = lastNDays(7).map((d) => ({
    label: WEEKDAYS[new Date(`${d}T00:00:00`).getDay()],
    value: state.study.reduce((m, p) => m + p.sessions.filter((x) => x.day === d).reduce((n, x) => n + x.min, 0), 0),
    color: 'gold',
  }))

  const addPlan = () => {
    const n = title.trim()
    if (!n) return
    dispatch({ type: 'STUDY_ADD', title: n, targetH, deadline })
    setTitle('')
    setDeadline('')
    sfx('pop')
  }

  const log = (plan) => {
    dispatch({ type: 'STUDY_LOG', id: plan.id, min, note: note.trim() })
    const xp = Math.min(30, Math.max(5, Math.round((min / 30) * 10)))
    const coins = min >= 30 ? 3 : 1
    sfx('check')
    reward(dispatch, { xp, coins, msg: `学了 ${min} 分钟`, icon: '📚' })
    setLogging(null)
    setNote('')
  }

  return (
    <>
      <Pomodoro />

      <Panel title="本周学习时长" icon="⏳" extra={<span className="xp-pill">本周共 {week.reduce((m, x) => m + x.value, 0)} 分钟</span>}>
        {state.study.length === 0 ? <Empty icon="📚">先立一个小目标吧！</Empty> : <Bars data={week} rows={8} scale={34} fmt={(v) => `${v}min`} />}
      </Panel>

      <Panel title="我的学习计划" icon="📚">
        {state.study.length === 0 && <Empty icon="🌱">比如「React 通关」「论文初稿」，给每个计划一个小时数和截止日。</Empty>}
        <div className="plan-list">
          {state.study.map((p) => {
            const done = studyDone(p)
            const target = p.targetH * 60
            const pct = Math.min(100, (done / target) * 100)
            const left = p.deadline ? daysBetween(t, p.deadline) : null
            const overdue = left !== null && left < 0
            return (
              <div key={p.id} className="card plan">
                <header className="plan-head">
                  <h4>{p.title}</h4>
                  {left !== null && (
                    <Chip color={overdue ? 'red' : left <= 7 ? 'orange' : 'green'}>
                      {overdue ? `已过期 ${-left} 天` : `剩 ${left} 天`}
                    </Chip>
                  )}
                  <button className="del" title="删除计划" onClick={async () => { if (await confirmBox({ title: '删除计划', message: `删除计划「${p.title}」？学习记录会一起删除哦`, danger: true, okText: '删除' })) { dispatch({ type: 'STUDY_DEL', id: p.id }); sfx('oops') } }}>×</button>
                </header>
                <Bar pct={pct} color={pct >= 100 ? 'gold' : 'green'} />
                <div className="plan-meta">
                  <span>⏱ {Math.round((done / 60) * 10) / 10} / {p.targetH} 小时</span>
                  <span>{pct >= 100 ? '🎉 达成！' : `还差 ${Math.max(0, Math.ceil((target - done) / 60 * 10) / 10)} 小时`}</span>
                </div>
                {logging === p.id ? (
                  <div className="add-row plan-log">
                    <select value={min} onChange={(e) => setMin(+e.target.value)}>
                      {[15, 25, 45, 60, 90, 120].map((v) => <option key={v} value={v}>{v} 分钟</option>)}
                    </select>
                    <input placeholder="学了什么（可选）" value={note} onChange={(e) => setNote(e.target.value)} />
                    <Btn color="green" size="sm" onClick={() => log(p)}>记好了</Btn>
                    <Btn size="sm" onClick={() => setLogging(null)}>取消</Btn>
                  </div>
                ) : (
                  <div className="btn-row">
                    <Btn size="sm" color="green" onClick={() => { setLogging(p.id); setMin(25); setNote('') }}>＋ 记录学习</Btn>
                  </div>
                )}
                {p.sessions.length > 0 && (
                  <details className="plan-sessions">
                    <summary>最近记录（{p.sessions.length} 次）</summary>
                    <ul>
                      {[...p.sessions].reverse().slice(0, 6).map((x, i) => (
                        <li key={i}><b>{fmtShort(x.day)}</b> · {x.min} 分钟{x.note ? ` · ${x.note}` : ''}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )
          })}
        </div>
      </Panel>

      <Panel title="立一个新计划" icon="🎯">
        <div className="form-row">
          <Field label="计划名">
            <input value={title} placeholder="比如：读完《深度工作》" onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addPlan() }} />
          </Field>
          <Field label="目标小时">
            <input type="number" min="1" value={targetH} onChange={(e) => setTargetH(+e.target.value || 1)} />
          </Field>
          <Field label="截止日期（可选）">
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </Field>
          <Btn color="green" onClick={addPlan}>＋ 立计划</Btn>
        </div>
      </Panel>
    </>
  )
}
