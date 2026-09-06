import React, { useEffect, useRef, useState } from 'react'
import {
  useApp, todosOpen, todosDoneToday, monthInOut, balanceOf, lastWeight,
  stageOf, STAGE_NAMES, BLOOM_PTS,
} from '../lib/store.jsx'
import { PixelSprite } from '../lib/sprites.jsx'
import { Panel, Btn, Bar, Chip } from '../components/ui.jsx'
import { MILESTONES, XP_GOAL, WATER_COST, reward, emit, sfx, emitConfetti } from '../lib/gamify.js'
import { useGSAP, gsap, D } from '../lib/anim.js'
import { greeting, fmtLong, seasonOf, pickByDay, dayKey } from '../lib/dates.js'

const WEATHERS = [
  { name: '大晴天', sprite: 'sun', copy: '先完成一件小事，快乐会慢慢长出来。' },
  { name: '多云', sprite: 'cloud', copy: '云朵在偷懒，你也别急，慢慢来。' },
  { name: '小雨', sprite: 'drop', copy: '雨天适合待在屋里，泡杯茶做点小事。' },
  { name: '流星夜', sprite: 'star', copy: '今晚有流星，记得许一个具体的小愿望。' },
  { name: '微风', sprite: 'heart', copy: '风把烦恼吹走了一点点，轻装上阵吧。' },
]
const POT_NAMES = { sunflower: '向日葵', tulip: '小郁金香', berry: '小浆果' }

// 数字滚动（仅对数值生效，字符串直接显示）
function Count({ value }) {
  const ref = useRef(null)
  const prev = useRef(0)
  useEffect(() => {
    if (typeof value !== 'number') {
      if (ref.current) ref.current.textContent = String(value)
      return
    }
    const o = { v: prev.current }
    prev.current = value
    gsap.killTweensOf(o)
    gsap.to(o, {
      v: value, duration: D(0.6), snap: { v: 1 },
      onUpdate: () => { if (ref.current) ref.current.textContent = Math.round(o.v) },
    })
  }, [value])
  return <span ref={ref}>{String(value)}</span>
}

export default function Dashboard() {
  const { state, dispatch } = useApp()
  const rootRef = useRef(null)
  const open = todosOpen(state)
  const doneToday = todosDoneToday(state)
  const todayTodosTotal = state.todos.filter((x) => x.day === dayKey()).length + open.filter((x) => x.day < dayKey()).length
  const habitsDone = state.habits.filter((h) => h.days[dayKey()]).length
  const w = lastWeight(state)
  const weather = pickByDay(WEATHERS, 'wx')
  const claimed = state.claimed[dayKey()] || []
  const freeWater = state.profile.waterLastDay !== dayKey()

  // 植物升级检测（含自动浇水带来的成长）
  const prevStages = useRef(null)
  useEffect(() => {
    const now = {}
    state.profile.pots.forEach((p) => { now[p.id] = stageOf(p.pts) })
    if (prevStages.current) {
      for (const [id, st] of Object.entries(now)) {
        if (st > prevStages.current[id]) {
          const el = document.getElementById(`pot-${id}`)
          if (el) gsap.fromTo(el, { scale: 0.8, rotation: -6 }, { scale: 1, rotation: 0, duration: D(0.6), ease: 'back.out(2)' })
          emit('toast', { icon: '🌱', text: `${POT_NAMES[id]}长到了「${STAGE_NAMES[st]}」！` })
          sfx('check')
        }
      }
    }
    prevStages.current = now
  }, [state.profile.pots])

  useGSAP(() => {
    // 可领取的礼箱心跳
    gsap.to('.gift.claimable', { scale: 1.08, yoyo: true, repeat: -1, duration: 0.5, ease: 'sine.inOut' })
    // 植物轻轻摇摆
    gsap.to('.plant-sprite', { rotation: 2.5, yoyo: true, repeat: -1, duration: 1.6, ease: 'sine.inOut', transformOrigin: '50% 90%' })
  }, { scope: rootRef })

  const water = () => {
    const cost = freeWater ? 0 : WATER_COST
    if (cost > state.profile.coins) {
      emit('toast', { icon: '🪙', text: '金币不够啦，完成任务赚一点再来～' })
      sfx('oops')
      return
    }
    const before = [...state.profile.pots].sort((a, b) => a.pts - b.pts)[0]
    dispatch({ type: 'WATER', cost })
    sfx('water')
    const el = document.getElementById(`pot-${before.id}`)
    if (el) {
      gsap.fromTo(el.querySelector('.drop-anim'), { y: -34, autoAlpha: 1 }, { y: 0, autoAlpha: 0, duration: D(0.5), ease: 'power2.in' })
      gsap.fromTo(el, { y: 4 }, { y: 0, duration: D(0.4), ease: 'back.out(2.5)', delay: D(0.3) })
    }
    emit('toast', { icon: '💧', text: cost ? `花 ${WATER_COST} 金币浇了一次水` : '今天第一次浇水，免费！' })
  }

  const claim = (m, e) => {
    if (state.xpToday < m.at || claimed.includes(m.at)) return
    dispatch({ type: 'MILESTONE_CLAIM', at: m.at, coins: m.coins })
    sfx('coin')
    const rect = e.currentTarget.getBoundingClientRect()
    emitConfetti(22, rect.left + rect.width / 2, rect.top)
    emit('toast', { icon: '🎁', text: `打开${m.label}，+${m.coins} 金币！` })
  }

  const stats = [
    { icon: '📝', label: '今日任务', value: `${doneToday.length}/${todayTodosTotal}`, sub: open.length ? `还剩 ${open.length} 件` : '全部完成！' },
    { icon: '✅', label: '习惯打卡', value: `${habitsDone}/${state.habits.length}`, sub: habitsDone === state.habits.length && state.habits.length ? '全点亮啦' : '点点更健康' },
    { icon: '💰', label: '账本结余', value: `¥${balanceOf(state).toLocaleString()}`, sub: `本月支出 ¥${monthInOut(state).o}` },
    { icon: '⚖️', label: '最新体重', value: w ? `${w.kg}kg` : '--', sub: w ? w.day.slice(5).replace('-', '/') : '去记录一下' },
    { icon: '💧', label: '累计浇水', value: state.profile.waterTotal, sub: `连续投入 ${state.profile.streak} 天` },
  ]

  return (
    <div ref={rootRef}>
      <section className="hero card">
        <div>
          <h2>{greeting()}，{state.profile.name}！</h2>
          <p className="hero-sub">{seasonOf()} · {fmtLong(dayKey())}</p>
        </div>
        <Chip color="gold" className="hero-chip">🔥 连续投入 {state.profile.streak} 天</Chip>
      </section>

      <Panel className="weather" accent="green">
        <div className="weather-inner">
          <PixelSprite name={weather.sprite} scale={5} className="weather-sprite" />
          <div>
            <h3>今天的小镇天气 · {weather.name}</h3>
            <p>{weather.copy}</p>
          </div>
        </div>
      </Panel>

      <div className="stat-grid">
        {stats.map((s) => (
          <div key={s.label} className="card stat">
            <span className="stat-icon">{s.icon}</span>
            <div className="stat-num"><Count value={s.value} /></div>
            <div className="stat-label">{s.label}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <Panel title="今日冒险进度" icon="🗺️" extra={<span className="xp-pill">⭐ <Count value={state.xpToday} /> / {XP_GOAL} XP</span>}>
        <Bar pct={(state.xpToday / XP_GOAL) * 100} color="green" />
        <p className="muted">每完成一件事都会获得 XP、小金币，还会自动给花园浇水。</p>
        <div className="gift-row">
          {MILESTONES.map((m) => {
            const got = claimed.includes(m.at)
            const can = !got && state.xpToday >= m.at
            return (
              <button
                key={m.at}
                className={`gift card ${got ? 'got' : can ? 'claimable' : 'locked'}`}
                onClick={(e) => claim(m, e)}
                title={`${m.at} XP 可领取 · ${m.label}`}
              >
                {got ? <span className="gift-done">✓</span> : <PixelSprite name="gift" scale={can ? 4 : 4} className={can ? '' : 'dim'} />}
                <span className="gift-xp">{m.at} XP</span>
                <span className="gift-coin">奖赏 +{m.coins} 🪙</span>
              </button>
            )
          })}
        </div>
      </Panel>

      <Panel
        title="我的成长植物园"
        icon="🌻"
        extra={<span className="xp-pill">累计浇水 {state.profile.waterTotal} 次</span>}
      >
        <div className="garden">
          {state.profile.pots.map((pot) => {
            const st = stageOf(pot.pts)
            const next = st < 4 ? BLOOM_PTS - pot.pts : 0
            const pct = Math.min(100, (pot.pts / BLOOM_PTS) * 100)
            return (
              <div key={pot.id} className="pot card" id={`pot-${pot.id}`}>
                <div className="pot-visual">
                  <PixelSprite name={st < 4 ? `p${st}` : `bloom_${pot.id}`} scale={6} className="plant-sprite" />
                  <span className="drop-anim"><PixelSprite name="drop" scale={3} /></span>
                </div>
                <div className="pot-name">{POT_NAMES[pot.id]}</div>
                <Chip className={`pot-stage ${st === 4 ? 'bloom' : ''}`}>{STAGE_NAMES[st]}</Chip>
                <Bar pct={pct} color={st === 4 ? 'gold' : 'green'} className="pot-bar" />
                <span className="pot-next">{st === 4 ? '盛开啦！再来一株？' : `再浇 ${next} 次开花`}</span>
              </div>
            )
          })}
        </div>
        <div className="garden-foot">
          <span className="muted">{freeWater ? '今天还有一次免费浇水机会 💧' : `今天已免费浇过，再浇一次花 ${WATER_COST} 金币`}</span>
          <Btn color="blue" onClick={water}>🪣 浇水壶</Btn>
        </div>
      </Panel>
    </div>
  )
}
