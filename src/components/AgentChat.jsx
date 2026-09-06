import React, { useEffect, useRef, useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { PixelSprite } from '../lib/sprites.jsx'
import { Btn, Chip, Panel } from './ui.jsx'
import { askAI, localAgent } from '../lib/ai.js'
import { sfx } from '../lib/gamify.js'
import { gsap, D } from '../lib/anim.js'

const SUGGESTIONS = [
  '今天还剩几件事？',
  '这个月花了多少？',
  '帮我记一条待办：给妈妈打电话',
  '记账 25 午饭',
  '最近体重怎么样？',
  '讲个冷笑话',
  '我有点累，鼓励我一下',
]

export default function AgentChat({ onOpenSettings }) {
  const { state, dispatch } = useApp()
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const listRef = useRef(null)
  const hasKey = !!state.settings.apiKey

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
    const last = el && el.lastElementChild
    if (last) {
      gsap.killTweensOf(last)
      gsap.fromTo(last, { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: D(0.28), ease: 'back.out(1.5)', overwrite: true })
    }
  }, [state.chat.length, busy])

  const send = async (text) => {
    const q = (text ?? input).trim()
    if (!q || busy) return
    sfx('pop')
    setInput('')
    dispatch({ type: 'CHAT_ADD', role: 'user', content: q })
    setBusy(true)
    let reply = null
    let action = null
    if (hasKey) {
      try {
        reply = await askAI({ state, input: q })
      } catch (err) {
        const local = localAgent(q, state)
        reply = `阿咕的大脑打了个盹（${err.message}），先用离线小脑回答你：\n${local.reply}`
        action = local.action
      }
    } else {
      await new Promise((r) => setTimeout(r, 550))
      const local = localAgent(q, state)
      reply = local.reply
      action = local.action
    }
    dispatch({ type: 'CHAT_ADD', role: 'assistant', content: reply })
    if (action) dispatch(action)
    setBusy(false)
  }

  return (
    <Panel className="agent-page">
      <header className="agent-head">
        <PixelSprite name="bird" scale={4} className="bob" />
        <div>
          <h3>阿咕 · 小镇精灵</h3>
          <p className="agent-sub">
            {hasKey ? '大模型模式 · 了解你的小镇数据' : '离线小精灵模式 · '}
            {!hasKey && <button className="linkish" onClick={onOpenSettings}>去设置里填 API Key，解锁更聪明的大脑 →</button>}
          </p>
        </div>
        <div className="agent-head-right">
          <Chip color={hasKey ? 'green' : ''}>{hasKey ? '🧠 大模型在线' : '🔌 离线兜底'}</Chip>
          <Btn size="sm" onClick={() => { if (confirm('清空和阿咕的聊天记录？')) dispatch({ type: 'CHAT_CLEAR' }) }}>清空</Btn>
        </div>
      </header>

      <div className="chat-list" ref={listRef}>
        {state.chat.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.role === 'assistant' && <PixelSprite name="bird" scale={2} className="msg-avatar" />}
            <div className="msg-bubble">
              {String(m.content).split('\n').map((line, j) => <p key={j}>{line}</p>)}
            </div>
          </div>
        ))}
        {busy && (
          <div className="msg assistant">
            <PixelSprite name="bird" scale={2} className="msg-avatar" />
            <div className="msg-bubble typing"><i /><i /><i /></div>
          </div>
        )}
      </div>

      <div className="sug-row">
        {SUGGESTIONS.map((s) => (
          <button key={s} className="sug" disabled={busy} onClick={() => send(s)}>{s}</button>
        ))}
      </div>

      <div className="chat-input">
        <input
          value={input}
          placeholder="和阿咕说点什么…（回车发送）"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send() }}
        />
        <Btn color="green" disabled={busy || !input.trim()} onClick={() => send()}>发送</Btn>
      </div>
    </Panel>
  )
}
