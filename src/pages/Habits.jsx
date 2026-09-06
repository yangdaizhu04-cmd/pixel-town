import React, { useState } from 'react'
import { useApp, habitStreak } from '../lib/store.jsx'
import { Panel, Btn, Empty, Chip, confirmBox } from '../components/ui.jsx'
import { REWARDS, DIFFS, diffOf, rewardBy, reward, sfx } from '../lib/gamify.js'
import { dayKey, addDays, lastNDays, fmtShort, WEEKDAYS } from '../lib/dates.js'

const EMOJIS = ['💧', '🏃', '📖', '🧘', '🎸', '🛏️', '🥗', '✏️', '🧹', '🌱']
const COLORS = ['green', 'blue', 'orange', 'pink']

export default function Habits() {
  const { state, dispatch } = useApp()
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('💧')
  const [color, setColor] = useState('green')
  const [diff, setDiff] = useState(2)
  const [weekOffset, setWeekOffset] = useState(0) // 0 = 本周，1 = 上周……
  const days = lastNDays(7, addDays(dayKey(), -weekOffset * 7))
  const t = dayKey()

  const doneToday = state.habits.filter((h) => h.days[t]).length

  const add = () => {
    const n = name.trim()
    if (!n) return
    dispatch({ type: 'HABIT_ADD', name: n, icon, color, diff })
    setName('')
    setDiff(2)
    sfx('pop')
  }

  const toggle = (habit, day) => {
    if (day > t) return
    const wasChecked = !!habit.days[day]
    dispatch({ type: 'HABIT_TOGGLE', id: habit.id, day })
    if (day === t && !wasChecked) {
      sfx('check')
      const r = rewardBy(REWARDS.habit, habit.diff)
      reward(dispatch, { ...r, msg: `习惯打卡 · ${diffOf(habit).label}`, icon: habit.icon })
    } else {
      sfx('pop')
    }
  }

  return (
    <>
      <Panel title="本周打卡" icon="✅" extra={<span className="xp-pill">{doneToday}/{state.habits.length} 今日完成</span>}>
        <p className="muted">点亮今天的小格子吧。过去的格子也可以补打（补打没有奖励，诚实第一 🙃）。</p>
        {state.habits.length === 0 ? (
          <Empty icon="🌱">种下第一个小习惯，比如「喝够 8 杯水」。</Empty>
        ) : (
          <>
            <div className="month-nav" style={{ marginBottom: 10 }}>
              <Btn size="sm" onClick={() => setWeekOffset(weekOffset + 1)}>← 更早一周</Btn>
              <Chip color={weekOffset === 0 ? 'green' : ''}>{weekOffset === 0 ? '本周' : `${weekOffset} 周前`}</Chip>
              <Btn size="sm" onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))} disabled={weekOffset === 0}>回到本周 →</Btn>
            </div>
            <div className="habit-table">
            <div className="habit-row habit-head">
              <div className="habit-name-cell" />
              {days.map((d) => (
                <div key={d} className={`habit-day-cell ${d === t ? 'today' : ''}`}>
                  <span>{WEEKDAYS[new Date(`${d}T00:00:00`).getDay()]}</span>
                  <em>{fmtShort(d)}</em>
                </div>
              ))}
              <div className="habit-streak-cell">连续</div>
            </div>
            {state.habits.map((h) => {
              // 连续天数按所看那一周的周末算：翻到上周时显示的是上周末的连续，而不是今天的
              const streak = habitStreak(h, days[days.length - 1])
              return (
                <div key={h.id} className="habit-row">
                  <div className="habit-name-cell">
                    <span className="habit-icon">{h.icon}</span>
                    <span className="habit-name">{h.name}</span>
                    {diffOf(h).id !== 2 && <span className="diff-mark" title={`难度：${diffOf(h).label}`}>{diffOf(h).icon}</span>}
                    <button className="del" title="删除习惯" onClick={async () => { if (await confirmBox({ title: '删除习惯', message: `删除习惯「${h.name}」？它的打卡记录也会一起消失哦`, danger: true, okText: '删除' })) { dispatch({ type: 'HABIT_DEL', id: h.id }); sfx('oops') } }}>×</button>
                  </div>
                  {days.map((d) => {
                    const checked = !!h.days[d]
                    const future = d > t
                    return (
                      <div key={d} className={`habit-day-cell ${d === t ? 'today' : ''}`}>
                        <button
                          className={`habit-cell ${checked ? 'on' : ''} c-${h.color}`}
                          disabled={future}
                          onClick={() => toggle(h, d)}
                          title={checked ? '取消打卡' : '打卡'}
                        >
                          {checked ? '✓' : ''}
                        </button>
                      </div>
                    )
                  })}
                  <div className="habit-streak-cell">
                    <Chip color={streak > 0 ? 'orange' : ''}>{streak > 0 ? `🔥 ${streak}` : '—'}</Chip>
                  </div>
                </div>
              )
            })}
            </div>
          </>
        )}
      </Panel>

      <Panel title="种一个新习惯" icon="🌱">
        <div className="add-row">
          <input
            value={name}
            aria-label="习惯名称"
            placeholder="习惯名字，比如：睡前拉伸 5 分钟"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add() }}
          />
          <div className="emoji-pick">
            {EMOJIS.map((e) => (
              <button key={e} className={`emoji-opt ${icon === e ? 'on' : ''}`} onClick={() => { setIcon(e); sfx('click') }}>{e}</button>
            ))}
          </div>
          <div className="emoji-pick">
            {COLORS.map((c) => (
              <button key={c} className={`color-opt c-${c} ${color === c ? 'on' : ''}`} onClick={() => setColor(c)} title={c} />
            ))}
          </div>
          <select value={diff} onChange={(e) => setDiff(Number(e.target.value))} title="难度：简单 ×0.6 · 普通 ×1 · 困难 ×1.6">
            {DIFFS.map((d) => <option key={d.id} value={d.id}>{d.icon} {d.label}</option>)}
          </select>
          <Btn color="green" onClick={add}>＋ 种下它</Btn>
        </div>
      </Panel>
    </>
  )
}