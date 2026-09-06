import React, { useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { Panel, Btn, Chip, Empty } from '../components/ui.jsx'
import { PixelSprite } from '../lib/sprites.jsx'
import { REWARDS, reward, sfx, emit } from '../lib/gamify.js'
import { dayKey, parseKey, monthKey, fmtShort, WEEKDAYS } from '../lib/dates.js'

const MOODS = ['超棒', '开心', '平静', '低落', '难过']
const MOOD_SPRITES = ['mood0', 'mood1', 'mood2', 'mood3', 'mood4']

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

  const loadDay = (d) => {
    const r = state.reviews[d]
    setActiveDay(d)
    setMood(r ? r.mood : 1)
    setGood(r ? r.good : '')
    setThanks(r ? r.thanks : '')
    setTomorrow(r ? r.tomorrow : '')
    sfx('pop')
  }

  const save = () => {
    dispatch({ type: 'REVIEW_SAVE', day: activeDay, mood, good: good.trim(), thanks: thanks.trim(), tomorrow: tomorrow.trim() })
    sfx('check')
    if (activeDay === t && !saved) reward(dispatch, { ...REWARDS.review, msg: '今日复盘存档', icon: '🌙', confetti: true })
    else emit('toast', { icon: '🌙', text: activeDay === t ? '复盘已更新' : '过去的这一天也补上了' })
  }

  const history = Object.entries(state.reviews).sort((a, b) => (a[0] < b[0] ? 1 : -1))

  return (
    <>
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
