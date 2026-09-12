import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { parseDateWords, parseLedgerCapture } from '../lib/parse.js'
import { dayKey, fmtShort } from '../lib/dates.js'
import { sfx, emit } from '../lib/gamify.js'
import { PAGES } from '../lib/nav.js'
import { WORDS } from '../lib/words.js'

// ⌘K / Ctrl+K 命令面板：快速捕捉（智能日期）、模块跳转、全局搜索。
// 灵感来自 personal-workbench 的 commands.js，按小镇口径重写：
// 普通文字 → 待办（支持 今天/明天/后天/大后天/周X/下周X/M月D日 前缀）；
// 「账 25 午饭」→ 记一笔支出；关键词同时搜索待办/账单/习惯/计划/目标/生词。

const relDay = (d) => {
  const t = dayKey()
  if (d === t) return '今天'
  return fmtShort(d)
}

function buildItems(q, state, ctx) {
  const { dispatch, onGo } = ctx
  const out = []
  const text = q.trim()

  // ---------- 捕捉 ----------
  const led = parseLedgerCapture(text)
  if (led) {
    out.push({
      group: '捕捉', icon: '💰',
      label: `记一笔支出：¥${led.amount}（${led.note}）`, hint: '回车记账',
      exec: () => {
        dispatch({ type: 'LEDGER_ADD', dir: 'out', amount: led.amount, cat: '餐饮', note: led.note })
        emit('toast', { icon: '📒', text: `已记账：支出 ¥${led.amount} · ${led.note}` })
      },
    })
  } else if (text && !/^记$/.test(text)) {
    const parsed = parseDateWords(text)
    const title = parsed.clean || text
    const day = parsed.day || dayKey()
    out.push({
      group: '捕捉', icon: '📝',
      label: `新待办：${title}${parsed.day ? `（${relDay(day)}）` : ''}`, hint: '回车添加',
      exec: () => {
        dispatch({ type: 'TODO_ADD', text: title.slice(0, 60), cat: '生活', day })
        emit('toast', { icon: '📝', text: `已添加到 ${relDay(day)}：${title.slice(0, 20)}` })
      },
    })
  }

  // ---------- 跳转 ----------
  PAGES.forEach((p) => {
    if (text && !(p.label.includes(text) || p.id.includes(text.toLowerCase()))) return
    out.push({ group: '跳转', icon: p.icon, label: p.label, hint: '打开页面', exec: () => onGo(p.id) })
  })
  if (!text) {
    out.push({ group: '捕捉', icon: '💡', label: '输入文字回车 → 新待办（支持 明天 / 周五 / 3月5日 开头）', hint: '', hintOnly: true })
    out.push({ group: '捕捉', icon: '💡', label: '「账 25 午饭」→ 快速记一笔支出', hint: '', hintOnly: true })
    out.push({ group: '捕捉', icon: '💡', label: '输入关键词 → 搜索待办 / 账单 / 习惯 / 计划 / 生词', hint: '', hintOnly: true })
    return out.slice(0, 12)
  }

  // ---------- 搜索 ----------
  const k = text.toLowerCase()
  const push = (icon, label, hint, pageId) => out.push({ group: '搜索', icon, label, hint, exec: () => onGo(pageId) })
  state.todos.filter((x) => x.text.toLowerCase().includes(k)).slice(0, 4)
    .forEach((x) => push('📝', x.text, `待办 · ${x.done ? '已完成' : x.day}`, 'todos'))
  state.ledger.filter((x) => (x.note || '').toLowerCase().includes(k) || String(x.amount) === text).slice(0, 3)
    .forEach((x) => push('💰', `${(x.note || '账单')} ¥${x.amount}`, `账单 · ${x.day}`, 'ledger'))
  state.habits.filter((x) => x.name.toLowerCase().includes(k)).slice(0, 2)
    .forEach((x) => push('✅', x.name, '习惯', 'habits'))
  state.study.filter((x) => x.title.toLowerCase().includes(k)).slice(0, 2)
    .forEach((x) => push('📚', x.title, '学习计划', 'study'))
  ;(state.goals || []).filter((x) => x.text.toLowerCase().includes(k)).slice(0, 2)
    .forEach((x) => push('🎯', x.text, `月目标 · ${x.month}`, 'review'))
  const wordHit = [
    ...(state.english.custom || []),
    ...WORDS,
  ].find((x) => x.w && x.w.toLowerCase() === k)
  if (wordHit) push('🔤', wordHit.w, `单词 · ${wordHit.zh || ''}`, 'english')

  return out.slice(0, 14)
}

export default function CommandPalette({ open, onClose, onGo }) {
  const { state, dispatch } = useApp()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const items = useMemo(
    () => (open ? buildItems(q, state, { dispatch, onClose, onGo }) : []),
    [q, state, dispatch, onClose, onGo, open], // eslint-disable-line react-hooks/exhaustive-deps
  )
  // 分组头渲染标记：换组的第一行画组名（预计算，渲染期不做变量再赋值）
  const rows = items.map((it, i) => ({ ...it, groupStart: i === 0 || items[i - 1].group !== it.group }))

  useEffect(() => {
    if (open) {
      setQ('')
      setSel(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  // 选中项滚进可视区
  useEffect(() => {
    listRef.current?.querySelector('.cmdk-item.sel')?.scrollIntoView({ block: 'nearest' })
  }, [sel, items.length])

  if (!open) return null

  const run = (it) => {
    if (!it || it.hintOnly) return
    sfx('click')
    onClose()
    it.exec?.()
  }
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((v) => Math.min(v + 1, items.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((v) => Math.max(v - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); run(items[sel]) }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  return (
    <div className="overlay cmdk-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="cmdk" role="dialog" aria-label="快速输入">
        <div className="cmdk-input">
          <span aria-hidden="true">⌘K</span>
          <input
            ref={inputRef}
            value={q}
            placeholder="记点什么 / 账 25 午饭 / 搜「报告」/ 跳转页面…"
            aria-label="快速输入"
            onChange={(e) => { setQ(e.target.value); setSel(0) }}
            onKeyDown={onKeyDown}
          />
        </div>
        <div className="cmdk-list" ref={listRef}>
          {items.length === 0 && <div className="cmdk-item hintOnly">没有匹配结果</div>}
          {rows.map((it, i) => (
            <React.Fragment key={`${it.group}-${i}`}>
              {it.groupStart && <div className="cmdk-group">{it.group}</div>}
              <div
                className={`cmdk-item ${i === sel ? 'sel' : ''} ${it.hintOnly ? 'hintOnly' : ''}`}
                onMouseMove={() => setSel(i)}
                onClick={() => run(it)}
              >
                <span className="cmdk-icon" aria-hidden="true">{it.icon}</span>
                <span className="cmdk-label">{it.label}</span>
                {it.hint && <span className="cmdk-hint">{it.hint}</span>}
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}
