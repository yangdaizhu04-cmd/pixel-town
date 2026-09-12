import React, { useEffect, useMemo, useState } from 'react'
import { useApp, studyDone } from '../lib/store.jsx'
import { Panel, Btn, Bar, Empty, Chip, Field, confirmBox } from '../components/ui.jsx'
import { Bars } from '../lib/charts.jsx'
import { PixelSprite } from '../lib/sprites.jsx'
import { reward, sfx, emit } from '../lib/gamify.js'
import { pomoSubscribe, pomoStart, pomoPause, pomoResume, pomoReset, pomoStop, pomoSetBreak } from '../lib/pomo.js'
import { soundAutoStart } from '../lib/sound.js'
import SoundPanel from '../components/SoundPanel.jsx'
import { dayKey, lastNDays, fmtShort, daysBetween, WEEKDAYS } from '../lib/dates.js'

const POMO_MINS = [15, 25, 45, 60]
const SLOTS = [
  { id: 'dawn', label: '🌅 清晨', a: 5, b: 9 },
  { id: 'am', label: '☀️ 上午', a: 9, b: 12 },
  { id: 'pm', label: '🌤️ 下午', a: 12, b: 18 },
  { id: 'eve', label: '🌙 晚间', a: 18, b: 23 },
  { id: 'night', label: '🌌 深夜', a: 23, b: 24 },
]
const fmtClock = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`

function Pomodoro() {
  const { state } = useApp()
  const [mode, setMode] = useState('focus') // 正在配置的模式（运行中不可切）
  const [min, setMin] = useState(25)
  const [minText, setMinText] = useState('25')
  const [breakMin, setBreakMin] = useState(5)
  const [breakText, setBreakText] = useState('5')
  const [planId, setPlanId] = useState('')
  const [pomo, setPomo] = useState(null)

  useEffect(() => pomoSubscribe(setPomo), [])

  const running = pomo?.running
  const curMode = pomo?.mode || mode // 运行/刚结束的一轮以 pomo 实际模式为准
  const isBreakNow = curMode === 'break'
  const durNow = isBreakNow ? breakMin : min
  const left = pomo?.left ?? durNow * 60
  const started = pomo && (pomo.left !== pomo.total || running)

  const pickFocusMin = (m) => {
    setMin(m); setMinText(String(m))
    if (!running) pomoReset(m, planId, 'focus')
    sfx('click')
  }
  // 自定义时长：合法范围 1-180 分钟，空闲时同步重置时钟
  const typeFocusMin = (text) => {
    setMinText(text)
    const v = Math.round(+text)
    if (v >= 1 && v <= 180) {
      setMin(v)
      if (!running && !started) pomoReset(v, planId, 'focus')
    }
  }
  const typeBreakMin = (text) => {
    setBreakText(text)
    const v = Math.round(+text)
    if (v >= 1 && v <= 60) {
      setBreakMin(v)
      pomoSetBreak(v)
      // 空闲（含上轮休息刚结束）时时钟实时跟随；暂停中的旧会话不打断
      if (!running && !started) pomoReset(v, '', 'break')
    }
  }
  const switchMode = (m) => {
    if (running || m === mode) return
    setMode(m)
    sfx('click')
    if (!started) pomoReset(m === 'break' ? breakMin : min, m === 'break' ? '' : planId, m)
  }

  const start = () => {
    if (mode === 'break') {
      pomoStart(breakMin, '', 'break')
      emit('toast', { icon: '☕', text: `休息 ${breakMin} 分钟，起来走走吧` })
    } else {
      pomoStart(min, planId, 'focus')
      soundAutoStart() // 开了「专注自动播放」就顺手把上次的声音组合打开（此处是点击手势，符合自动播放策略）
      emit('toast', { icon: '🍅', text: `番茄钟出发！接下来 ${min} 分钟属于你` })
    }
  }

  return (
    <Panel
      title="像素番茄钟" icon="🍅"
      extra={
        <div className="pomo-extra">
          {state.study.length > 0 && (
            <select value={planId} onChange={(e) => setPlanId(e.target.value)} title="专注完成后记到哪个计划">
              <option value="">自由专注（不挂计划）</option>
              {state.study.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          )}
          <span className="pomo-total">已累计 {state.profile.stats?.pomos || 0} 🍅</span>
        </div>
      }
    >
      <div className="pomo">
        <div className={`pomo-clock card ${running ? 'on' : ''} ${isBreakNow ? 'brk' : ''}`}>
          {running && <PixelSprite name="bird" scale={3} className="bob pomo-bird" />}
          <span className="pomo-time">{fmtClock(left)}</span>
          <span className="pomo-hint">
            {running
              ? (isBreakNow ? '休息中…喝口水，看看远处' : (planId ? '专注中…完成后自动记进计划' : '专注中…阿咕陪着你'))
              : started
                ? '暂停中，歇会也行'
                : (isBreakNow ? '休息轮待命，或切回专注' : '选好时长，开始一段专注')}
          </span>
        </div>
        <div className="pomo-ctrl">
          <div className="pomo-set">
            <div className="seg">
              <button className={curMode === 'focus' ? 'on' : ''} disabled={running} onClick={() => switchMode('focus')}>🎯 专注</button>
              <button className={curMode === 'break' ? 'on' : ''} disabled={running} onClick={() => switchMode('break')}>☕ 休息</button>
            </div>
            {mode === 'focus' ? (
              <>
                <div className="seg">
                  {POMO_MINS.map((m) => (
                    <button key={m} className={min === m ? 'on' : ''} disabled={running} onClick={() => pickFocusMin(m)}>{m} 分</button>
                  ))}
                </div>
                <input
                  type="number" min="1" max="180" className="pomo-custom"
                  value={minText}
                  disabled={running}
                  title="自定义专注时长，1-180 分钟"
                  onChange={(e) => typeFocusMin(e.target.value)}
                />
                <span className="pomo-custom-unit">分钟</span>
              </>
            ) : (
              <>
                <input
                  type="number" min="1" max="60" className="pomo-custom"
                  value={breakText}
                  disabled={running}
                  title="休息时长，1-60 分钟"
                  onChange={(e) => typeBreakMin(e.target.value)}
                />
                <span className="pomo-custom-unit">分钟休息（专注结束后会自动开始）</span>
              </>
            )}
          </div>
          <div className="btn-row">
            {!running
              ? <Btn color="green" onClick={() => { if (started) pomoResume(); else start() }}>{started ? '继续 ▶' : (mode === 'break' ? `开始休息 ▶（${breakMin} 分）` : `开始专注 ▶（${min} 分）`)}</Btn>
              : <Btn color="gold" onClick={() => pomoPause()}>暂停 ⏸</Btn>}
            <Btn onClick={() => { pomoReset(durNow, curMode === 'focus' ? planId : '', curMode); if (mode === 'break') pomoSetBreak(breakMin) }}>重置 ↻</Btn>
            {started && <Btn color="red" onClick={() => pomoStop()}>放弃</Btn>}
          </div>
          <p className="muted">专注结束会自动进入休息轮（休息不发奖励，纯属劳逸结合）；时长都能自己定，中途切页也继续走，完成自动记时长、发 XP。</p>
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
  // 派生统计依赖 state.study，用 useMemo 缓存，避免计划/记录增多后每次渲染都重算（待优化 5）
  const week = useMemo(
    () => lastNDays(7, t).map((d) => ({
      label: WEEKDAYS[new Date(`${d}T00:00:00`).getDay()],
      value: state.study.reduce((m, p) => m + p.sessions.filter((x) => x.day === d).reduce((n, x) => n + x.min, 0), 0),
      color: 'gold',
    })),
    [state.study, t],
  )
  // 专注统计：近 14 天时长 + 时段分布（只统计带时刻的新记录）
  const days14 = useMemo(
    () => lastNDays(14, t).map((d) => ({
      label: String(+d.slice(8, 10)),
      value: state.study.reduce((m, p) => m + p.sessions.filter((x) => x.day === d).reduce((n, x) => n + x.min, 0), 0),
      color: 'green',
    })),
    [state.study, t],
  )
  const total14 = days14.reduce((m, x) => m + x.value, 0)
  const slots = useMemo(
    () => SLOTS.map((s) => ({
      label: s.label,
      value: state.study.reduce((m, p) => m + p.sessions.filter((x) => x.h != null && x.h >= s.a && x.h < s.b).reduce((n, x) => n + x.min, 0), 0),
      color: 'orange',
    })),
    [state.study],
  )
  const withHour = useMemo(
    () => state.study.reduce((m, p) => m + p.sessions.filter((x) => x.h != null).length, 0),
    [state.study],
  )

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
      <SoundPanel />

      <Panel title="本周学习时长" icon="⏳" extra={<span className="xp-pill">本周共 {week.reduce((m, x) => m + x.value, 0)} 分钟</span>}>
        {state.study.length === 0 ? <Empty icon="📚">先立一个小目标吧！</Empty> : <Bars data={week} rows={8} scale={34} fmt={(v) => `${v}min`} />}
      </Panel>

      <Panel title="专注分布" icon="📈" extra={<span className="xp-pill">近 14 天 {total14} 分钟</span>}>
        <Bars data={days14} rows={8} scale={30} fmt={(v) => `${v}m`} />
        <p className="muted">你在一天里的哪个时间段更容易专注？{withHour === 0 ? '完成一次番茄钟后这里就有答案了～' : `（已统计 ${withHour} 次带时刻的记录）`}</p>
        <Bars data={slots} rows={6} scale={36} fmt={(v) => `${v}m`} />
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
                  <button className="del" title="删除计划" onClick={async () => { if (await confirmBox({ title: '删除计划', message: `删除计划「${p.title}」？学习记录会一起移入回收站（保留 30 天）`, danger: true, okText: '删除' })) { dispatch({ type: 'STUDY_DEL', id: p.id }); sfx('oops'); emit('toast', { icon: '🗑️', text: '已移入回收站，30 天内可在设置 → 数据里恢复' }) } }}>×</button>
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
                        <li key={`${x.day}-${x.min}-${i}`}><b>{fmtShort(x.day)}</b> · {x.min} 分钟{x.note ? ` · ${x.note}` : ''}</li>
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
            <input value={title} aria-label="计划名称" placeholder="比如：读完《深度工作》" onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addPlan() }} />
          </Field>
          <Field label="目标小时">
            <input type="number" min="1" aria-label="目标小时" value={targetH} onChange={(e) => setTargetH(+e.target.value || 1)} />
          </Field>
          <Field label="截止日期（可选）">
            <input type="date" aria-label="截止日期" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </Field>
          <Btn color="green" onClick={addPlan}>＋ 立计划</Btn>
        </div>
      </Panel>
    </>
  )
}
