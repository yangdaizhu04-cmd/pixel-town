import React, { useMemo, useState } from 'react'
import { useApp, balanceOf, monthInOut } from '../lib/store.jsx'
import { Panel, Btn, Empty, Chip } from '../components/ui.jsx'
import { Bars } from '../lib/charts.jsx'
import { sfx, emit } from '../lib/gamify.js'
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
const chartColorOf = (c) => CAT_COLORS[c] || 'brown'

const monthShift = (mk, n) => {
  const d = new Date(`${mk}-01T00:00:00`)
  d.setMonth(d.getMonth() + n)
  return monthKey(dayKey(d))
}
const monthLabel = (mk) => `${+mk.slice(5, 7)} 月`

export default function Ledger() {
  const { state, dispatch } = useApp()
  const [dir, setDir] = useState('out')
  const [amount, setAmount] = useState('')
  const [cat, setCat] = useState('餐饮')
  const [note, setNote] = useState('')
  const [mk, setMk] = useState(monthKey())       // 正在查看的月份
  const [filterCat, setFilterCat] = useState('') // 流水筛选：分类
  const [filterType, setFilterType] = useState('') // 流水筛选：支出/收入

  const { i, o } = monthInOut(state, mk)
  const cats = dir === 'out' ? CATS_OUT : CATS_IN
  const budgets = state.budgets || {}
  const t = dayKey()

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
    for (const e of state.ledger) {
      if (!e.day.startsWith(mk)) continue
      if (filterCat && e.cat !== filterCat) continue
      if (filterType && e.type !== filterType) continue
      ;(m[e.day] = m[e.day] || []).push(e)
    }
    return Object.entries(m).sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [state.ledger, mk, filterCat, filterType])

  const add = () => {
    const v = Math.round(+amount * 100) / 100
    if (!v || v <= 0) return
    dispatch({ type: 'LEDGER_ADD', dir, amount: v, cat, note: note.trim() })
    setAmount('')
    setNote('')
    sfx('coin')
  }

  const setBudget = (c, v) => dispatch({ type: 'BUDGET_SET', cat: c, amount: Math.round(+v || 0) })

  const exportCsv = () => {
    const rows = [['日期', '类型', '分类', '金额', '备注']]
    for (const e of state.ledger) rows.push([e.day, e.type === 'in' ? '收入' : '支出', e.cat, e.amount, (e.note || '').replace(/"/g, '""')])
    const csv = '\uFEFF' + rows.map((r) => r.map((x) => `"${x}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `pixel-town-ledger-${mk}.csv`
    a.click()
    URL.revokeObjectURL(url)
    emit('toast', { icon: '🧾', text: '账本 CSV 已导出（Excel 可直接打开）' })
  }

  const budgetRow = (c) => {
    const spent = (byCat.find((x) => x.label === c) || {}).value || 0
    const budget = budgets[c]
    const pct = budget ? Math.min(100, (spent / budget) * 100) : 0
    const over = budget && spent > budget
    return (
      <div key={c} className="budget-row">
        <span className="budget-cat">{catIcon(c)} {c}</span>
        <input
          type="number" min="0" placeholder="预算 ¥"
          value={budget || ''}
          onChange={(e) => setBudget(c, e.target.value)}
        />
        {budget ? (
          <div className={`budget-bar ${over ? 'over' : ''}`}>
            <div className="budget-fill" style={{ width: `${pct}%` }} />
            <span>{spent}/{budget}{over ? ' · 超啦 😯' : ''}</span>
          </div>
        ) : <span className="budget-hint">未设预算</span>}
      </div>
    )
  }

  return (
    <>
      <div className="stat-grid three">
        <div className="card stat">
          <span className="stat-icon">📈</span>
          <div className="stat-num">¥{i.toLocaleString()}</div>
          <div className="stat-label">{monthLabel(mk)}收入</div>
        </div>
        <div className="card stat">
          <span className="stat-icon">📉</span>
          <div className="stat-num">¥{o.toLocaleString()}</div>
          <div className="stat-label">{monthLabel(mk)}支出</div>
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

      <Panel title={`${monthLabel(mk)}钱都去哪了`} icon="📊" extra={
        <div className="month-nav">
          <Btn size="sm" onClick={() => setMk(monthShift(mk, -1))}>←</Btn>
          <Chip>{mk}</Chip>
          <Btn size="sm" onClick={() => setMk(monthShift(mk, 1))} disabled={mk >= monthKey()}>→</Btn>
        </div>
      }>
        {byCat.length === 0 ? <Empty icon="🧾">这个月还没有支出记录，记一笔试试～</Empty> : (
          <Bars data={byCat} rows={9} scale={26} fmt={(v) => `¥${v}`} />
        )}
      </Panel>

      <Panel
        title="账本流水" icon="📒"
        extra={
          <div className="ledger-filters">
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="">全部</option>
              <option value="out">支出</option>
              <option value="in">收入</option>
            </select>
            <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
              <option value="">全部分类</option>
              {CATS_OUT.concat(CATS_IN).map((c, i) => <option key={`${c.id}-${i}`} value={c.id}>{c.icon} {c.id}</option>)}
            </select>
            <Btn size="sm" onClick={exportCsv}>⬇ CSV</Btn>
          </div>
        }
      >
        {byDay.length === 0 && <Empty icon="🪙">这个月（或这个筛选下）还没有流水。</Empty>}
        {byDay.map(([day, entries]) => (
          <div key={day} className="ledger-day">
            <div className="ledger-date">{day === t ? '今天' : fmtShort(day)}</div>
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

      <Panel title="每月预算" icon="🧮">
        <p className="muted">给常花的分类设个月预算，花超了进度条会变红提醒你（只提醒，不指责）。</p>
        <div className="budgets">
          {CATS_OUT.filter((c) => c.id !== '其他').map((c) => budgetRow(c.id))}
        </div>
      </Panel>
    </>
  )
}
