import React, { useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { Panel, Btn, Chip, Empty, confirmBox } from '../components/ui.jsx'
import { PixelSprite } from '../lib/sprites.jsx'
import { Bars } from '../lib/charts.jsx'
import { REWARDS, reward, sfx, emit } from '../lib/gamify.js'
import { aggregate } from '../lib/weekly.js'
import { questionOf } from '../lib/questions.js'
import { dayKey, parseKey, monthKey, fmtShort, WEEKDAYS, addDays } from '../lib/dates.js'

const MOODS = ['超棒', '开心', '平静', '低落', '难过']
const MOOD_SPRITES = ['mood0', 'mood1', 'mood2', 'mood3', 'mood4']

// 月度目标：本月立几个小目标，达成发大奖（+30 XP +15 金币）。
// 撤销不打折也不追回奖励（宽恕优先，和小镇的其余规则一致）。
function MonthlyGoals({ state, dispatch }) {
  const [text, setText] = useState('')
  const mk = monthKey()
  const cur = (state.goals || []).filter((g) => g.month === mk)
  const past = (state.goals || []).filter((g) => g.month !== mk)
  const add = () => {
    const n = text.trim()
    if (!n) return
    dispatch({ type: 'GOAL_ADD', text: n.slice(0, 40), month: mk })
    setText('')
    sfx('pop')
  }
  const toggle = (g) => {
    if (!g.done) {
      dispatch({ type: 'GOAL_TOGGLE', id: g.id })
      sfx('levelup')
      reward(dispatch, { ...REWARDS.goal, msg: '月度目标达成', icon: '🎯', confetti: true })
    } else {
      dispatch({ type: 'GOAL_TOGGLE', id: g.id })
      sfx('pop')
    }
  }
  const del = async (g) => {
    const ok = await confirmBox({ title: '删除目标', message: `删除「${g.text}」？会先移入回收站，30 天内可恢复。`, danger: true, okText: '删除' })
    if (!ok) return
    dispatch({ type: 'GOAL_DEL', id: g.id })
    sfx('oops')
  }

  return (
    <Panel title="本月目标" icon="🎯" extra={<span className="xp-pill">{cur.filter((g) => g.done).length}/{cur.length} 达成</span>}>
      <p className="muted">一个月能认真做完两三件小事，就已经很了不起了。达成会发大额奖励 🎉</p>
      <div className="goal-list">
        {cur.length === 0 && <p className="muted">这个月还没立目标——写一个「小到不可能失败」的？</p>}
        {cur.map((g) => (
          <div key={g.id} className={`goal-item card ${g.done ? 'done' : ''}`}>
            <button className={`check ${g.done ? 'on' : ''}`} title={g.done ? '标记未完成' : '标记达成'} onClick={() => toggle(g)} />
            <span className="goal-text">{g.text}</span>
            {g.done && <Chip color="green">达成 ✓</Chip>}
            <button className="del" title="删除" onClick={() => del(g)}>×</button>
          </div>
        ))}
      </div>
      <div className="add-row goal-add">
        <input
          value={text}
          aria-label="新目标"
          placeholder="比如：读完一本书的第一章 / 每周散步三次"
          maxLength={40}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add() }}
        />
        <Btn color="green" onClick={add}>＋ 立个目标</Btn>
      </div>
      {past.length > 0 && (
        <details className="goal-past">
          <summary>往月目标（{past.length}）</summary>
          <ul>
            {past.map((g) => (
              <li key={g.id}>
                <span className={g.done ? 'goal-done-text' : ''}>{g.month} · {g.text}</span>
                {g.done && <Chip color="green">✓</Chip>}
                <button className="del" title="删除" onClick={() => del(g)}>×</button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Panel>
  )
}

// 每周小结：按所选周忠实汇总小镇数据（周一起始，可回看前几周）
// 聚合口径复用 weekly.js 的 aggregate（与 Museum 周报同一份真相），按天各聚合一次
function WeeklyReport({ state }) {
  const [off, setOff] = useState(0) // 0 = 本周，1 = 上周……
  const t = dayKey()
  const dow = (parseKey(t).getDay() + 6) % 7 // 周一 = 0
  const from = addDays(t, -dow - off * 7)
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i))
  const dayStats = days.map((d) => {
    const a = aggregate(state, [d])
    return {
      d,
      xp: a.xp,
      active: a.xp > 0,
      todosDone: a.todos,
      min: a.focusMin,
      out: a.expense,
      inc: a.income,
      mood: state.reviews?.[d]?.mood ?? null,
    }
  })
  const sum = (k) => dayStats.reduce((m, x) => m + x[k], 0)
  const activeDays = dayStats.filter((x) => x.active).length
  const best = dayStats.some((x) => x.mood != null)
    ? dayStats.filter((x) => x.mood != null).reduce((a, b) => (b.mood < a.mood ? b : a))
    : null

  return (
    <Panel
      title="每周小结" icon="📊"
      extra={
        <div className="month-nav">
          <Btn size="sm" onClick={() => setOff(off + 1)}>← 更早一周</Btn>
          <Chip color={off === 0 ? 'green' : ''}>{off === 0 ? '本周' : `${off} 周前`}</Chip>
          <Btn size="sm" onClick={() => setOff(Math.max(0, off - 1))} disabled={off === 0}>回到本周 →</Btn>
        </div>
      }
    >
      <div className="report-chips">
        <span className="report-chip"><b>{activeDays}</b> 活跃天</span>
        <span className="report-chip"><b>{sum('xp')}</b> XP</span>
        <span className="report-chip"><b>{sum('todosDone')}</b> 件待办</span>
        <span className="report-chip"><b>{sum('min')}</b> 分钟专注</span>
        <span className="report-chip"><b>¥{sum('out')}</b> 支出</span>
        <span className="report-chip"><b>¥{sum('inc')}</b> 收入</span>
      </div>
      <Bars
        data={days.map((d, i) => ({
          label: WEEKDAYS[parseKey(d).getDay()],
          value: dayStats[i].xp,
          color: dayStats[i].xp > 0 ? 'gold' : 'green',
        }))}
        rows={8} scale={30}
        fmt={(v) => `${v}XP`}
      />
      {best && <p className="muted">这周心情最好的那天是 {fmtShort(best.d)}：{MOODS[best.mood]} ✨</p>}
    </Panel>
  )
}

// 整月心情月历：点任意一天可以把那天的复盘调进表单（写过去的日期不加奖励，诚实第一）
function MoodMonth({ reviews, activeDay, onPick }) {
  const [mk, setMk] = useState(monthKey())
  const first = `${mk}-01`
  const pad = parseKey(first).getDay()
  const daysInMonth = new Date(+mk.slice(0, 4), +mk.slice(5, 7), 0).getDate()
  const shift = (n) => {
    const d = parseKey(first)
    d.setMonth(d.getMonth() + n)
    setMk(monthKey(dayKey(d)))
  }
  const label = `${mk.slice(0, 4)} 年 ${+mk.slice(5, 7)} 月`
  const moodDays = Object.keys(reviews).filter((d) => d.startsWith(mk)).length

  return (
    <div className="mood-month">
      <div className="month-nav">
        <Btn size="sm" onClick={() => shift(-1)}>←</Btn>
        <b>{label}</b>
        <Btn size="sm" onClick={() => shift(1)} disabled={mk >= monthKey()}>→</Btn>
        <Chip color={moodDays > 0 ? 'green' : ''}>{moodDays} 天有心事</Chip>
      </div>
      <div className="mood-grid">
        {WEEKDAYS.map((w) => <div key={w} className="mood-grid-head">{w}</div>)}
        {Array.from({ length: pad }, (_, i) => <div key={`b${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const d = `${mk}-${String(i + 1).padStart(2, '0')}`
          const r = reviews[d]
          return (
            <button
              key={d}
              className={`mood-cell ${d === activeDay ? 'today' : ''} ${r ? 'has' : ''}`}
              onClick={() => onPick(d)}
              title={r ? `${fmtShort(d)} · ${MOODS[r.mood]}` : fmtShort(d)}
            >
              {r ? <PixelSprite name={MOOD_SPRITES[r.mood]} scale={1.6} /> : <span>{i + 1}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function Review() {
  const { state, dispatch } = useApp()
  const t = dayKey()
  const [activeDay, setActiveDay] = useState(t)
  const saved = state.reviews[activeDay]
  const [mood, setMood] = useState(saved ? saved.mood : 1)
  const [good, setGood] = useState(saved ? saved.good : '')
  const [thanks, setThanks] = useState(saved ? saved.thanks : '')
  const [tomorrow, setTomorrow] = useState(saved ? saved.tomorrow : '')
  const [ask, setAsk] = useState(saved ? (saved.ask || '') : '')

  const loadDay = (d) => {
    const r = state.reviews[d]
    setActiveDay(d)
    setMood(r ? r.mood : 1)
    setGood(r ? r.good : '')
    setThanks(r ? r.thanks : '')
    setTomorrow(r ? r.tomorrow : '')
    setAsk(r ? (r.ask || '') : '')
    sfx('pop')
  }

  const save = () => {
    dispatch({ type: 'REVIEW_SAVE', day: activeDay, mood, good: good.trim(), thanks: thanks.trim(), tomorrow: tomorrow.trim(), ask: ask.trim() })
    sfx('check')
    if (activeDay === t && !saved) reward(dispatch, { ...REWARDS.review, msg: '今日复盘存档', icon: '🌙', confetti: true })
    else emit('toast', { icon: '🌙', text: activeDay === t ? '复盘已更新' : '过去的这一天也补上了' })
  }

  const history = Object.entries(state.reviews).sort((a, b) => (a[0] < b[0] ? 1 : -1))

  return (
    <>
      <WeeklyReport state={state} />
      <MonthlyGoals state={state} dispatch={dispatch} />

      <Panel
        title={activeDay === t ? '今晚，和自己聊两句' : `${fmtShort(activeDay)} 的那晚`}
        icon="🌙"
        extra={saved && <Chip color="green">已存档 ✓</Chip>}
      >
        <p className="muted">不需要长篇大论，一句真话就够。{activeDay === t ? '存档后 +15 XP，还能点亮心情月历。' : '补写旧日记不加奖励——但回忆本身就很值。'}</p>

        <div className="mood-row">
          {MOODS.map((m, i) => (
            <button key={m} className={`mood-opt card ${mood === i ? 'on' : ''}`} onClick={() => { setMood(i); sfx('pop') }}>
              <PixelSprite name={MOOD_SPRITES[i]} scale={4} />
              <span>{m}</span>
            </button>
          ))}
        </div>

        <div className="review-form">
          <div className="ask-day">
            <span className="field-label">💬 今日一问（{fmtShort(activeDay)}）</span>
            <p className="ask-q">{questionOf(activeDay)}</p>
            <textarea rows={2} value={ask} placeholder="想到什么写什么，不答也行。" onChange={(e) => setAsk(e.target.value)} />
          </div>
          <label className="field">
            <span className="field-label">✨ 今天的高光时刻</span>
            <textarea rows={2} value={good} placeholder="再小都算数：晒到了太阳、准时下班、喝够了水……" onChange={(e) => setGood(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">🍀 想感谢的一件小事</span>
            <textarea rows={2} value={thanks} placeholder="感谢一个人、一顿饭、一阵风……" onChange={(e) => setThanks(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">🌤️ 明天最想做的一件小事</span>
            <textarea rows={2} value={tomorrow} placeholder="只写一件，让它小到不可能失败。" onChange={(e) => setTomorrow(e.target.value)} />
          </label>
          <div className="btn-row">
            <Btn color="green" onClick={save}>{saved ? '更新存档' : '存进小本本'}</Btn>
            {activeDay !== t && <Btn onClick={() => loadDay(t)}>回到今天</Btn>}
          </div>
        </div>
      </Panel>

      <Panel title="心情月历" icon="🗓️">
        <MoodMonth reviews={state.reviews} activeDay={activeDay} onPick={loadDay} />
        <p className="muted">点有日期的格子，可以回看或补写那一天的心情。</p>
      </Panel>

      <Panel title="复盘小本本" icon="📔">
        {history.length === 0 ? (
          <Empty icon="🌙">第一篇复盘会从这里开始。</Empty>
        ) : (
          <ul className="review-list">
            {history.map(([day, r]) => (
              <li key={day} className="card review-item" onClick={() => loadDay(day)} title="点我回看 / 补写这一天">
                <div className="review-item-head">
                  <PixelSprite name={MOOD_SPRITES[r.mood] || 'mood1'} scale={2} />
                  <b>{day === t ? '今天' : fmtShort(day)}</b>
                  <Chip>{MOODS[r.mood] || '心情'}</Chip>
                </div>
                {r.ask && <p className="review-line">💬 {r.ask}</p>}
                {r.good && <p className="review-good">✨ {r.good}</p>}
                {r.thanks && <p className="review-line">🍀 {r.thanks}</p>}
                {r.tomorrow && <p className="review-line">🌤️ {r.tomorrow}</p>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  )
}
