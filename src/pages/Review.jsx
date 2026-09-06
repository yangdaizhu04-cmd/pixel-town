import React, { useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { Panel, Btn, Chip, Empty } from '../components/ui.jsx'
import { PixelSprite } from '../lib/sprites.jsx'
import { REWARDS, reward, sfx, emit } from '../lib/gamify.js'
import { dayKey, lastNDays, fmtShort } from '../lib/dates.js'

const MOODS = ['超棒', '开心', '平静', '低落', '难过']
const MOOD_SPRITES = ['mood0', 'mood1', 'mood2', 'mood3', 'mood4']

export default function Review() {
  const { state, dispatch } = useApp()
  const t = dayKey()
  const saved = state.reviews[t]
  const [mood, setMood] = useState(saved ? saved.mood : 1)
  const [good, setGood] = useState(saved ? saved.good : '')
  const [thanks, setThanks] = useState(saved ? saved.thanks : '')
  const [tomorrow, setTomorrow] = useState(saved ? saved.tomorrow : '')

  const save = () => {
    dispatch({ type: 'REVIEW_SAVE', day: t, mood, good: good.trim(), thanks: thanks.trim(), tomorrow: tomorrow.trim() })
    sfx('check')
    if (!saved) reward(dispatch, { ...REWARDS.review, msg: '今日复盘存档', icon: '🌙', confetti: true })
    else emitToast('复盘已更新')
  }

  const history = Object.entries(state.reviews).sort((a, b) => (a[0] < b[0] ? 1 : -1))
  const week = lastNDays(7)

  return (
    <>
      <Panel title="今晚，和自己聊两句" icon="🌙" extra={saved && <Chip color="green">今日已存档 ✓</Chip>}>
        <p className="muted">不需要长篇大论，一句真话就够。存档后 +15 XP，还能点亮心情月历。</p>

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
          </div>
        </div>
      </Panel>

      <Panel title="最近 7 天心情" icon="🗓️">
        <div className="mood-week">
          {week.map((d) => {
            const r = state.reviews[d]
            return (
              <div key={d} className={`mood-day card ${d === t ? 'today' : ''}`}>
                <span className="mood-day-date">{fmtShort(d)}</span>
                {r ? <PixelSprite name={MOOD_SPRITES[r.mood]} scale={2} /> : <span className="mood-none">·</span>}
              </div>
            )
          })}
        </div>
      </Panel>

      <Panel title="复盘小本本" icon="📔">
        {history.length === 0 ? (
          <Empty icon="🌙">第一篇复盘会从这里开始。</Empty>
        ) : (
          <ul className="review-list">
            {history.map(([day, r]) => (
              <li key={day} className="card review-item">
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

function emitToast(text) {
  emit('toast', { icon: '🌙', text })
}
