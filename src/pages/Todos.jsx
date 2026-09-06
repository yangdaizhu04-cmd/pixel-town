import React, { useRef, useState } from 'react'
import { useApp, todosOpen, todosDoneToday } from '../lib/store.jsx'
import { Panel, Btn, Bar, Empty, Chip, confirmBox } from '../components/ui.jsx'
import { REWARDS, reward, sfx } from '../lib/gamify.js'
import { dayKey, addDays } from '../lib/dates.js'

const CATS = [
  { id: '工作', icon: '💼' },
  { id: '生活', icon: '🏠' },
  { id: '学习', icon: '📚' },
  { id: '其他', icon: '✨' },
]
const catIcon = (c) => (CATS.find((x) => x.id === c) || CATS[3]).icon
const REPEAT_LABEL = { daily: '↻ 每天', weekly: '↻ 每周' }

export default function Todos() {
  const { state, dispatch } = useApp()
  const [text, setText] = useState('')
  const [cat, setCat] = useState('生活')
  const [prio, setPrio] = useState(false)
  const [repeat, setRepeat] = useState('')

  const t = dayKey()
  const open = todosOpen(state).sort((a, b) => (b.prio - a.prio) || (a.day < b.day ? -1 : 1))
  const done = todosDoneToday(state)
  const total = open.length + done.length
  const pct = total ? (done.length / total) * 100 : 0
  // 重复待办单日只奖励一次：防止「取消今日完成 → 再勾回」反复刷 XP（刷新后失效，属宽恕优先的折中）
  const rewardedToday = useRef(new Set())

  const add = () => {
    const s = text.trim()
    if (!s) return
    dispatch({ type: 'TODO_ADD', text: s, cat, prio, repeat })
    setText('')
    setPrio(false)
    setRepeat('')
    sfx('pop')
  }

  const toggle = (todo) => {
    const nowDone = todo.repeat ? todo.lastDone !== t : !todo.done
    dispatch({ type: 'TODO_TOGGLE', id: todo.id })
    if (nowDone) {
      sfx('check')
      const firstToday = !todo.repeat || !rewardedToday.current.has(todo.id)
      if (firstToday) {
        rewardedToday.current.add(todo.id)
        reward(dispatch, { ...REWARDS.todo, msg: '完成任务', icon: '✅', confetti: true })
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
              <button className="del" title="删除" onClick={() => { dispatch({ type: 'TODO_DEL', id: td.id }); sfx('oops') }}>×</button>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title="今日已完成" icon="🎉"
        extra={done.length > 0 && (
          <div className="btn-row">
            <Btn size="sm" onClick={() => dispatch({ type: 'TODO_CLEAR_DONE' })}>清空今日记录</Btn>
            <Btn
              size="sm" color="red"
              onClick={async () => {
                const ok = await confirmBox({ title: '清空全部已完成', message: '把历史已完成待办也一并清掉？\n只删「已完成」的——没做的和重复待办不受影响。', danger: true, okText: '清空' })
                if (ok) { dispatch({ type: 'TODO_CLEAR_ALL_DONE' }); sfx('oops') }
              }}
            >清空全部</Btn>
          </div>
        )}
      >
        {done.length === 0 ? (
          <Empty icon="⏳">还没有完成记录。完成第一件事，来拿 +10 XP！</Empty>
        ) : (
          <ul className="todo-list done-list">
            {done.map((td) => (
              <li key={td.id} className="todo done">
                <button className="check on" title={td.repeat ? '取消今日完成' : '放回清单'} onClick={() => toggle(td)} />
                <span className="todo-text">{td.text}</span>
                {td.repeat && <Chip color="blue">{REPEAT_LABEL[td.repeat]} 明天再来</Chip>}
                <Chip>{catIcon(td.cat)} {td.cat}</Chip>
                <button className="del" title="删除" onClick={() => { dispatch({ type: 'TODO_DEL', id: td.id }); sfx('oops') }}>×</button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  )
}
