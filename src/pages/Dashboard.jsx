import React, { useEffect, useRef, useState } from 'react'
import {
  useApp, todosOpen, todosDoneToday, monthInOut, balanceOf, lastWeight,
  stageOf, STAGE_NAMES, BLOOM_PTS,
} from '../lib/store.jsx'
import { PixelSprite } from '../lib/sprites.jsx'
import { Panel, Btn, Bar, Chip } from '../components/ui.jsx'
import ShopModal from '../components/ShopModal.jsx'
import { MILESTONES, XP_GOAL, WATER_COST, emit, sfx, emitConfetti } from '../lib/gamify.js'
import { MAX_POTS, PLANT_META, plantName } from '../lib/shop.js'
import { useGSAP, gsap, D } from '../lib/anim.js'
import { greeting, fmtLong, pickByDay, dayKey } from '../lib/dates.js'
import { fetchWeatherByCity, fetchWeatherByGeo } from '../lib/weather.js'

const WEATHERS = [
  { name: '大晴天', sprite: 'sun', copy: '先完成一件小事，快乐会慢慢长出来。' },
  { name: '多云', sprite: 'cloud', copy: '云朵在偷懒，你也别急，慢慢来。' },
  { name: '小雨', sprite: 'drop', copy: '雨天适合待在屋里，泡杯茶做点小事。' },
  { name: '流星夜', sprite: 'star', copy: '今晚有流星，记得许一个具体的小愿望。' },
  { name: '微风', sprite: 'heart', copy: '风把烦恼吹走了一点点，轻装上阵吧。' },
]

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
  const [shopOpen, setShopOpen] = useState(false)
  const [wxLoaded, setWxLoaded] = useState({ key: '', data: null })
  const open = todosOpen(state)
  const doneToday = todosDoneToday(state)
  const habitsDone = state.habits.filter((h) => h.days[dayKey()]).length
  const w = lastWeight(state)
  // 真实天气：跟随定位（weatherMode='geo'）或指定城市（'city'）；都未启用/失败时回退小镇预言。
  // 渲染期按「来源 key 是否已加载完成」派生，不在 effect 里同步 setState。
  // 注意：weather 的声明必须在上面的 wx 之前——const 有暂时性死区，顺序反了首屏白屏（踩坑 16）。
  const wxMode = state.settings.weatherMode || ''
  const wxKey = wxMode === 'geo' ? 'geo' : wxMode === 'city' ? `city:${state.settings.city}` : ''
  const weather = wxKey && wxLoaded.key === wxKey ? wxLoaded.data : null
  const wx = weather || pickByDay(WEATHERS, 'wx')
  const claimed = state.claimed[dayKey()] || []
  const freeWater = state.profile.waterLastDay !== dayKey()

  useEffect(() => {
    if (!wxKey) return
    let alive = true
    const job = wxMode === 'geo' ? fetchWeatherByGeo() : fetchWeatherByCity(state.settings.city)
    job.then((r) => { if (alive) setWxLoaded({ key: wxKey, data: r }) })
    return () => { alive = false }
  }, [wxKey, wxMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // 植物升级检测（含自动浇水带来的成长）
  const prevStages = useRef(null)
  useEffect(() => {
    const now = {}
    state.profile.pots.forEach((p) => { now[p.id] = p.kind ? stageOf(p.pts) : -1 })
    if (prevStages.current) {
      for (const [id, st] of Object.entries(now)) {
        if (prevStages.current[id] >= 0 && st > prevStages.current[id]) {
          const pot = state.profile.pots.find((x) => x.id === id)
          const el = document.getElementById(`pot-${id}`)
          if (el) gsap.fromTo(el, { scale: 0.8, rotation: -6 }, { scale: 1, rotation: 0, duration: D(0.6), ease: 'back.out(2)' })
          emit('toast', { icon: '🌱', text: `${plantName(pot?.kind)}长到了「${STAGE_NAMES[st]}」！` })
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
    // 空花园不浇水：没有种植物的盆时直接提醒，避免白花金币
    if (!state.profile.pots.some((x) => x.kind)) {
      emit('toast', { icon: '🪴', text: '花园里还没有植物，先在空盆里种下种子吧～' })
      sfx('oops')
      return
    }
    const cost = freeWater ? 0 : WATER_COST
    if (cost > state.profile.coins) {
      emit('toast', { icon: '🪙', text: '金币不够啦，完成任务赚一点再来～' })
      sfx('oops')
      return
    }
    const before = [...state.profile.pots].filter((x) => x.kind).sort((a, b) => a.pts - b.pts)[0]
    dispatch({ type: 'WATER', cost })
    sfx('water')
    if (before) {
      const el = document.getElementById(`pot-${before.id}`)
      if (el) {
        gsap.fromTo(el.querySelector('.drop-anim'), { y: -34, autoAlpha: 1 }, { y: 0, autoAlpha: 0, duration: D(0.5), ease: 'power2.in' })
        gsap.fromTo(el, { y: 4 }, { y: 0, duration: D(0.4), ease: 'back.out(2.5)', delay: D(0.3) })
      }
    }
    emit('toast', { icon: '💧', text: cost ? `花 ${WATER_COST} 金币浇了一次水` : '今天第一次浇水，免费！' })
  }

  const harvest = (pot) => {
    dispatch({ type: 'HARVEST', potId: pot.id, coins: 6 })
    sfx('coin')
    emitConfetti(20)
    emit('toast', { icon: '🌼', text: `采下「${plantName(pot.kind)}」的种子，+6 金币！图鉴里已经收录` })
  }

  const plant = (pot, kind) => {
    dispatch({ type: 'PLANT_POT', potId: pot.id, kind })
    sfx('check')
    emit('toast', { icon: '🌰', text: `种下了一株${plantName(kind)}，等待发芽吧` })
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
    { icon: '📝', label: '今日任务', value: `${doneToday.length}/${open.length + doneToday.length}`, sub: open.length ? `还剩 ${open.length} 件` : '全部完成！' },
    { icon: '✅', label: '习惯打卡', value: `${habitsDone}/${state.habits.length}`, sub: habitsDone === state.habits.length && state.habits.length ? '全点亮啦' : '点点更健康' },
    { icon: '💰', label: '账本结余', value: `¥${balanceOf(state).toLocaleString()}`, sub: `本月支出 ¥${monthInOut(state).o}` },
    { icon: '⚖️', label: '最新体重', value: w ? `${w.kg}kg` : '--', sub: w ? w.day.slice(5).replace('-', '/') : '去记录一下' },
    { icon: '💧', label: '累计浇水', value: state.profile.waterTotal, sub: `连续投入 ${state.profile.streak} 天` },
  ]

  const emptyPots = state.profile.pots.filter((x) => !x.kind).length

  return (
    <div ref={rootRef}>
      <section className="hero card">
        <div>
          <h2>{greeting()}，{state.profile.name}！</h2>
          <p className="hero-sub">{fmtLong(dayKey())}</p>
        </div>
        <Chip color="gold" className="hero-chip">🔥 连续投入 {state.profile.streak} 天</Chip>
      </section>

      <Panel className="weather" accent="green">
        <div className="weather-inner">
          <PixelSprite name={wx.sprite} scale={5} className="weather-sprite" />
          <div>
            <h3>
              今天的小镇天气 · {wx.name}
              {weather
                ? <Chip color="blue" className="weather-tag">{wxMode === 'geo' ? '📍 ' : ''}{weather.temp}°C · {weather.city}</Chip>
                : <Chip className="weather-tag">小镇预言 · 设置里可开启真实天气</Chip>}
            </h3>
            <p>{wx.copy}</p>
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
                {got ? <span className="gift-done">✓</span> : <PixelSprite name="gift" scale={4} className={can ? '' : 'dim'} />}
                <span className="gift-xp">{m.at} XP</span>
                <span className="gift-coin">奖赏 🎁 盲盒</span>
              </button>
            )
          })}
        </div>
      </Panel>

      <Panel
        title="我的成长植物园" icon="🌻"
        extra={
          <span className="xp-pill">
            累计浇水 {state.profile.waterTotal} 次{state.profile.pots.length < MAX_POTS ? ` · 花园还可扩建 ${MAX_POTS - state.profile.pots.length} 格` : ''}
          </span>
        }
      >
        <div className="garden">
          {state.profile.pots.map((pot) => {
            const st = pot.kind ? stageOf(pot.pts) : -1
            const bloomed = st === 4
            const next = st >= 0 && st < 4 ? BLOOM_PTS - pot.pts : 0
            const pct = pot.kind ? Math.min(100, (pot.pts / BLOOM_PTS) * 100) : 0
            return (
              <div key={pot.id} className="pot card" id={`pot-${pot.id}`}>
                <div className="pot-visual">
                  <PixelSprite name={st < 0 ? 'pot_empty' : st < 4 ? `p${st}` : `bloom_${pot.kind}`} scale={6} className="plant-sprite" />
                  <span className="drop-anim"><PixelSprite name="drop" scale={3} /></span>
                </div>
                {!pot.kind ? (
                  <div className="pot-plant-pick">
                    <span className="pot-next">空花盆</span>
                    <select defaultValue="" onChange={(e) => e.target.value && plant(pot, e.target.value)}>
                      <option value="">种点什么…</option>
                      {PLANT_META.filter((p) => (state.profile.unlockedKinds || []).includes(p.id)).map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <>
                    <div className="pot-name">{plantName(pot.kind)}</div>
                    <Chip className={`pot-stage ${bloomed ? 'bloom' : ''}`}>{STAGE_NAMES[st]}</Chip>
                    <Bar pct={pct} color={bloomed ? 'gold' : 'green'} className="pot-bar" />
                    <span className="pot-next">
                      {bloomed ? '盛开啦！' : `再浇 ${next} 次开花`}
                    </span>
                    {bloomed && <Btn size="sm" color="gold" onClick={() => harvest(pot)}>🌼 采集种子 +6🪙</Btn>}
                  </>
                )}
              </div>
            )
          })}
        </div>
        {(state.profile.decor || []).length > 0 && (
          <div className="garden-decor">
            {state.profile.decor.map((d) => <PixelSprite key={d} name={`decor_${d}`} scale={4} />)}
          </div>
        )}
        <div className="garden-foot">
          <span className="muted">
            {freeWater ? '今天还有一次免费浇水机会 💧' : `今天已免费浇过，再浇一次花 ${WATER_COST} 金币`}
            {emptyPots > 0 ? ` · 有 ${emptyPots} 个空盆等着种子` : ''}
          </span>
          <div className="btn-row">
            <Btn onClick={() => { setShopOpen(true); sfx('click') }}>🛒 小镇商店</Btn>
            <Btn color="blue" onClick={water}>🪣 浇水壶</Btn>
          </div>
        </div>
      </Panel>

      <ShopModal open={shopOpen} onClose={() => setShopOpen(false)} />
    </div>
  )
}
