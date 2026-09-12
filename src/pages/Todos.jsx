import React, { useMemo, useState } from 'react'
import { useApp, todosOpen, todosDoneToday } from '../lib/store.jsx'
import { Panel, Btn, Bar, Empty, Chip, confirmBox } from '../components/ui.jsx'
import { REWARDS, DIFFS, diffOf, rewardBy, reward, sfx, emit } from '../lib/gamify.js'
import { dayKey, addDays } from '../lib/dates.js'

const CATS = [
  { id: '工作', icon: '💼' },
  { id: '生活', icon: '🏠' },
  { id: '学习', icon: '📚' },
  { id: '其他', icon: '✨' },
]
const catIcon = (c) => (CATS.find((x) => x.id === c) || CATS[3]).icon
const REPEAT_LABEL = { daily: '↻ 每天', weekly: '↻ 每周' }

// 单日单条待办只奖励一次，key 里带日期天然跨天失效。
// 必须放模块级而不是 useRef：App 的 <main key={page}> 切页会整页重挂，ref 会被清空，
// 反复进出页面就能对同一条待办重复领 XP（普通待办「完成→撤销→再完成」同理）。
const rewardedToday = new Set()

// 难度标记：只有非普通才显示，避免普通任务刷屏
function DiffMark({ diff }) {
  const d = diffOf({ diff })
  return d.id === 2 ? null : <Chip className="diff-mark" title={`难度：${d.label}`}>{d.icon} {d.label}</Chip>
}

export default function Todos() {
  const { state, dispatch } = useApp()
  const [text, setText] = useState('')
  const [cat, setCat] = useState('生活')
  const [prio, setPrio] = useState(false)
  const [repeat, setRepeat] = useState('')
  const [diff, setDiff] = useState(2)

  const t = dayKey()
  // todosOpen/todosDoneToday 只读 s.todos（isDue 依赖当天日期），依赖切片比整个 state 更准；oxlint 看不进纯函数内部，行内豁免
  const open = useMemo(() => todosOpen(state).sort((a, b) => (b.prio - a.prio) || (a.day < b.day ? -1 : 1)), [state.todos, t]) // eslint-disable-line react-hooks/exhaustive-deps
  const done = useMemo(() => todosDoneToday(state), [state.todos, t]) // eslint-disable-line react-hooks/exhaustive-deps
  const total = open.length + done.length
  const pct = total ? (done.length / total) * 100 : 0

  const add = () => {
    const s = text.trim()
    if (!s) return
    dispatch({ type: 'TODO_ADD', text: s, cat, prio, repeat, diff })
    setText('')
    setPrio(false)
    setRepeat('')
    setDiff(2)
    sfx('pop')
  }

  const toggle = (todo) => {
    const nowDone = todo.repeat ? todo.lastDone !== t : !todo.done
    dispatch({ type: 'TODO_TOGGLE', id: todo.id })
    if (nowDone) {
      sfx('check')
      const rewardKey = `${t}:${todo.id}`
      if (!rewardedToday.has(rewardKey)) {
        rewardedToday.add(rewardKey)
        const r = rewardBy(REWARDS.todo, todo.diff)
        reward(dispatch, { ...r, msg: `完成任务 · ${diffOf(todo).label}`, icon: '✅', confetti: todo.diff === 3 })
      }
    } else {
      sfx('pop')
    }
  }

  const postpone = (todo, day) => {
    dispatch({ type: 'TODO_POSTPONE', id: todo.id, day })
    sfx('pop')
  }

  return (
    <>
      <Panel title="今日待办" icon="📝" extra={<span className="xp-pill">{done.length}/{total} 完成</span>}>
        <Bar pct={pct} color="green" />
        <div className="add-row">
          <button className={`prio-flag ${prio ? 'on' : ''}`} title="标为优先" onClick={() => setPrio(!prio)}>⚑</button>
          <input
            value={text}
            aria-label="新待办内容"
            placeholder="想完成点什么？回车快速添加"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add() }}
          />
          <select value={cat} onChange={(e) => setCat(e.target.value)}>
            {CATS.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.id}</option>)}
          </select>
          <select value={repeat} onChange={(e) => setRepeat(e.target.value)} title="重复规则">
            <option value="">不重复</option>
            <option value="daily">↻ 每天</option>
            <option value="weekly">↻ 每周</option>
          </select>
          <select value={diff} onChange={(e) => setDiff(Number(e.target.value))} title="难度：简单 ×0.6 · 普通 ×1 · 困难 ×1.6">
            {DIFFS.map((d) => <option key={d.id} value={d.id}>{d.icon} {d.label}</option>)}
          </select>
          <Btn color="green" onClick={add}>＋ 添加</Btn>
        </div>

        {open.length === 0 && done.length === 0 && <Empty icon="🌤️">清单空空的，睡个懒觉也值得被记录哦。</Empty>}
        {open.length === 0 && done.length > 0 && <Empty icon="🎉">今天的事情全部做完啦，阿咕宣布：可以去玩！</Empty>}

        <ul className="todo-list">
          {open.map((td) => (
            <li key={td.id} className={`todo ${td.repeat === '' && td.day < t ? 'overdue' : ''}`}>
              <button className="check" title="完成" onClick={() => toggle(td)} />
              {td.prio && <span className="prio-flag on" title="优先">⚑</span>}
              <span className="todo-text">{td.text}</span>
              {td.repeat && <Chip color="blue">{REPEAT_LABEL[td.repeat]}</Chip>}
              <DiffMark diff={td.diff} />
              {!td.repeat && td.day < t && (
                <>
                  <Chip className="todo-day">{td.day.slice(5)} 逾期</Chip>
                  <Btn size="sm" onClick={() => postpone(td, t)}>📌 放到今天</Btn>
                </>
              )}
              {!td.repeat && td.day === t && (
                <Btn size="sm" onClick={() => postpone(td, addDays(t, 1))} title="明天再说，也挺好的">⏭ 明天</Btn>
              )}
              <Chip>{catIcon(td.cat)} {td.cat}</Chip>
              <button className="del" title="删除" onClick={() => { dispatch({ type: 'TODO_DEL', id: td.id }); sfx('oops'); emit('toast', { icon: '🗑️', text: '已移入回收站，30 天内可在设置 → 数据里恢复' }) }}>×</button>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title="今日已完成" icon="🎉"
        extra={done.length > 0 && (
          <div className="btn-row">
            <Btn size="sm" onClick={() => { dispatch({ type: 'TODO_CLEAR_DONE' }); emit('toast', { icon: '🗑️', text: '已完成记录清掉了，回收站里躺 30 天，误删可找回' }) }}>清空今日记录</Btn>
            <Btn
              size="sm" color="red"
              onClick={async () => {
                const ok = await confirmBox({ title: '清空全部已完成', message: '把历史已完成待办也一并清掉？\n只删「已完成」的——没做的和重复待办不受影响。', danger: true, okText: '清空' })
                if (ok) { dispatch({ type: 'TODO_CLEAR_ALL_DONE' }); sfx('oops'); emit('toast', { icon: '🗑️', text: '历史已完成清掉了，回收站里躺 30 天，误删可找回' }) }
              }}
            >清空全部</Btn>
          </div>
        )}
      >
        {done.length === 0 ? (
          <Empty icon="⏳">还没有完成记录。完成第一件事，来拿 XP 奖励！</Empty>
        ) : (
          <ul className="todo-list done-list">
            {done.map((td) => (
              <li key={td.id} className="todo done">
                <button className="check on" title={td.repeat ? '取消今日完成' : '放回清单'} onClick={() => toggle(td)} />
                <span className="todo-text">{td.text}</span>
                {td.repeat && <Chip color="blue">{REPEAT_LABEL[td.repeat]} 明天再来</Chip>}
                <DiffMark diff={td.diff} />
                <Chip>{catIcon(td.cat)} {td.cat}</Chip>
                <button className="del" title="删除" onClick={() => { dispatch({ type: 'TODO_DEL', id: td.id }); sfx('oops'); emit('toast', { icon: '🗑️', text: '已移入回收站，30 天内可在设置 → 数据里恢复' }) }}>×</button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  )
}