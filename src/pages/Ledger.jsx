import React, { useMemo, useState } from 'react'
import { useApp, balanceOf, monthInOut } from '../lib/store.jsx'
import { Panel, Btn, Empty, Chip, Field } from '../components/ui.jsx'
import { Bars } from '../lib/charts.jsx'
import { sfx } from '../lib/gamify.js'
import { dayKey, monthKey, fmtShort } from '../lib/dates.js'

const CATS_OUT = [
  { id: '餐饮', icon: '🍜' }, { id: '购物', icon: '🛍️' }, { id: '交通', icon: '🚌' },
  { id: '娱乐', icon: '🎮' }, { id: '生活', icon: '🏠' }, { id: '学习', icon: '📚' },
  { id: '健康', icon: '💊' }, { id: '其他', icon: '✨' },
]
const CATS_IN = [
  { id: '工资', icon: '💼' }, { id: '其他', icon: '✨' },
]
const CAT_COLORS = { 餐饮: 'orange', 购物: 'pink', 交通: 'blue', 娱乐: 'red', 生活: 'green', 学习: 'gold', 健康: 'greenD', 其他: 'brown', 工资: 'green' }
const catIcon = (c) => (CATS_OUT.concat(CATS_IN).find((x) => x.id === c) || { icon: '✨' }).icon
const COLORS = ['orange', 'pink', 'blue', 'red', 'green', 'gold', 'greenD', 'brown']
const chartColorOf = (c) => CAT_COLORS[c] || 'brown'

export default function Ledger() {
  const { state, dispatch } = useApp()
  const [dir, setDir] = useState('out')
  const [amount, setAmount] = useState('')
  const [cat, setCat] = useState('餐饮')
  const [note, setNote] = useState('')

  const mk = monthKey()
  const { i, o } = monthInOut(state)
  const cats = dir === 'out' ? CATS_OUT : CATS_IN

  const byCat = useMemo(() => {
    const m = {}
    for (const e of state.ledger) {
      if (e.type !== 'out' || !e.day.startsWith(mk)) continue
      m[e.cat] = (m[e.cat] || 0) + e.amount
    }
    return Object.entries(m)
      .map(([label, value]) => ({ label, value, color: chartColorOf(label) }))
      .sort((a, b) => b.value - a.value)
  }, [state.ledger, mk])

  const byDay = useMemo(() => {
    const m = {}
    for (const e of state.ledger) (m[e.day] = m[e.day] || []).push(e)
    return Object.entries(m).sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [state.ledger])

  const add = () => {
    const v = Math.round(+amount * 100) / 100
    if (!v || v <= 0) return
    dispatch({ type: 'LEDGER_ADD', dir, amount: v, cat, note: note.trim() })
    setAmount('')
    setNote('')
    sfx('coin')
  }

  return (
    <>
      <div className="stat-grid three">
        <div className="card stat">
          <span className="stat-icon">📈</span>
          <div className="stat-num">¥{i.toLocaleString()}</div>
          <div className="stat-label">本月收入</div>
        </div>
        <div className="card stat">
          <span className="stat-icon">📉</span>
          <div className="stat-num">¥{o.toLocaleString()}</div>
          <div className="stat-label">本月支出</div>
        </div>
        <div className="card stat">
          <span className="stat-icon">🏦</span>
          <div className="stat-num">¥{balanceOf(state).toLocaleString()}</div>
          <div className="stat-label">小镇总结余</div>
        </div>
      </div>

      <Panel title="记一笔" icon="💰">
        <div className="add-row">
          <div className="seg">
            <button className={dir === 'out' ? 'on' : ''} onClick={() => { setDir('out'); setCat('餐饮'); sfx('click') }}>支出</button>
            <button className={dir === 'in' ? 'on' : ''} onClick={() => { setDir('in'); setCat('工资'); sfx('click') }}>收入</button>
          </div>
          <input
            type="number"
            className="amount-input"
            placeholder="金额"
            value={amount}
            min="0"
            step="0.01"
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add() }}
          />
          <input
            placeholder="备注（可选）"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add() }}
          />
          <Btn color="green" onClick={add}>＋ 记好了</Btn>
        </div>
        <div className="cat-pick">
          {cats.map((c) => (
            <button key={c.id} className={`cat-opt ${cat === c.id ? 'on' : ''}`} onClick={() => { setCat(c.id); sfx('click') }}>
              {c.icon} {c.id}
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="本月钱都去哪了" icon="📊">
        {byCat.length === 0 ? <Empty icon="🧾">本月还没有支出记录，记一笔试试～</Empty> : (
          <Bars data={byCat} rows={9} scale={26} fmt={(v) => `¥${v}`} />
        )}
      </Panel>

      <Panel title="账本流水" icon="📒">
        {byDay.length === 0 && <Empty icon="🪙">账本还空着。攒钱和攒 XP 一样，都是慢慢来的。</Empty>}
        {byDay.map(([day, entries]) => (
          <div key={day} className="ledger-day">
            <div className="ledger-date">{day === dayKey() ? '今天' : fmtShort(day)}</div>
            <ul className="ledger-list">
              {entries.map((e) => (
                <li key={e.id} className={`ledger-item ${e.type}`}>
                  <span className="ledger-cat">{catIcon(e.cat)}</span>
                  <span className="ledger-note">{e.note || e.cat}</span>
                  <Chip className={CAT_COLORS[e.cat] ? `c-${CAT_COLORS[e.cat]}` : ''}>{e.cat}</Chip>
                  <span className="ledger-amount">{e.type === 'in' ? '+' : '−'}¥{e.amount}</span>
                  <button className="del" title="删除" onClick={() => { dispatch({ type: 'LEDGER_DEL', id: e.id }); sfx('oops') }}>×</button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Panel>
    </>
  )
}
