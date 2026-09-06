import React, { useEffect, useRef, useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { PixelSprite, birdNameForHat } from '../lib/sprites.jsx'
import { Btn, Chip, Panel, confirmBox } from './ui.jsx'
import { askAI, localAgent, parseActs } from '../lib/ai.js'
import { sfx, emit } from '../lib/gamify.js'
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

// 阿咕 + 帽子：帽子直接合成在鸟的字符画里（bird_leaf / bird_berry / bird_crown）
export function BirdAvatar({ scale = 4, className = '' }) {
  const { state } = useApp()
  return (
    <span className={`bird-wrap ${className}`}>
      <PixelSprite name={birdNameForHat(state.profile.hat)} scale={scale} />
    </span>
  )
}

export default function AgentChat({ onOpenSettings }) {
  const { state, dispatch } = useApp()
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [streamText, setStreamText] = useState('')
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
  }, [state.chat.length, busy, streamText])

  const send = async (text) => {
    const q = (text ?? input).trim()
    if (!q || busy) return
    sfx('pop')
    setInput('')
    dispatch({ type: 'CHAT_ADD', role: 'user', content: q })
    setBusy(true)
    setStreamText('')
    let reply = null
    let action = null
    let acts = []
    if (hasKey) {
      try {
        const full = await askAI({
          state,
          input: q,
          onDelta: (_d, fullText) => setStreamText(fullText),
        })
        const parsed = parseActs(full)
        reply = parsed.clean || '（阿咕咕哝了一声，什么也没说）'
        acts = parsed.acts
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
    setStreamText('')
    dispatch({ type: 'CHAT_ADD', role: 'assistant', content: reply })
    // ACT 标记 → 真实入库；本地模式则走 localAgent 附带的 action
    for (const act of acts) dispatch(act.type === 'LEDGER_ADD' ? { type: 'LEDGER_ADD', ...act } : act)
    if (action) dispatch(action)
    if (acts.length) emit('toast', { icon: '🐣', text: '阿咕已经帮你办好啦' })
    setBusy(false)
  }

  return (
    <Panel className="agent-page">
      <header className="agent-head">
        <BirdAvatar scale={4} className="bob" />
        <div>
          <h3>阿咕 · 小镇精灵</h3>
          <p className="agent-sub">
            {hasKey ? '大模型模式 · 了解你的小镇数据 · 能帮你记事' : '离线小精灵模式 · '}
            {!hasKey && <button className="linkish" onClick={onOpenSettings}>去设置里填 API Key，解锁更聪明的大脑 →</button>}
          </p>
        </div>
        <div className="agent-head-right">
          <Chip color={hasKey ? 'green' : ''}>{hasKey ? '🧠 大模型在线' : '🔌 离线兜底'}</Chip>
          <Btn size="sm" onClick={async () => { if (await confirmBox({ title: '清空聊天', message: '清空和阿咕的聊天记录？', danger: true, okText: '清空' })) { dispatch({ type: 'CHAT_CLEAR' }); sfx('oops') } }}>清空</Btn>
        </div>
      </header>

      <div className="chat-list" ref={listRef}>
        {state.chat.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.role === 'assistant' && <BirdAvatar scale={2} className="msg-avatar" />}
            <div className="msg-bubble">
              {String(m.content).split('\n').map((line, j) => <p key={j}>{line}</p>)}
            </div>
          </div>
        ))}
        {busy && (
          <div className="msg assistant">
            <BirdAvatar scale={2} className="msg-avatar" />
            {streamText ? (
              <div className="msg-bubble">
                {streamText.split('\n').map((line, j) => <p key={j}>{line}</p>)}
              </div>
            ) : (
              <div className="msg-bubble typing"><i /><i /><i /></div>
            )}
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
          aria-label="和阿咕说点什么"
          placeholder="和阿咕说点什么…（回车发送）"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send() }}
        />
        <Btn color="green" disabled={busy || !input.trim()} onClick={() => send()}>发送</Btn>
      </div>
    </Panel>
  )
}
