import React, { useEffect, useRef, useState } from 'react'
import { gsap, D } from '../lib/anim.js'
import { sfx, emit, on } from '../lib/gamify.js'

export function Panel({ title, icon, extra, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || extra) && (
        <header className="card-head">
          <h3>{icon && <span className="card-icon">{icon}</span>}{title}</h3>
          {extra && <div className="card-extra">{extra}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

export function Btn({ children, onClick, color = '', size = '', disabled, title, type = 'button', className = '' }) {
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      className={`btn ${color} ${size} ${className}`}
      onClick={(e) => { sfx('click'); if (onClick) onClick(e) }}
    >
      {children}
    </button>
  )
}

export function Chip({ children, color = '', className = '', title }) {
  return <span className={`chip ${color} ${className}`} title={title}>{children}</span>
}

export function Bar({ pct, color = 'green', stripe = true, className = '' }) {
  return (
    <div className={`bar ${className}`}>
      <div
        className={`bar-fill ${color} ${stripe ? 'stripe' : ''}`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  )
}

export function Modal({ open, onClose, title, children, wide }) {
  const overlayRef = useRef(null)
  const panelRef = useRef(null)
  useEffect(() => {
    if (!open) return
    gsap.fromTo(overlayRef.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: D(0.18), overwrite: true })
    gsap.fromTo(panelRef.current, { y: 44, scale: 0.96, autoAlpha: 0 }, { y: 0, scale: 1, autoAlpha: 1, duration: D(0.3), ease: 'back.out(1.4)', overwrite: true })
    const esc = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!open) return null
  return (
    <div
      className="overlay"
      ref={overlayRef}
      onMouseDown={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className={`modal panel ${wide ? 'wide' : ''}`} ref={panelRef}>
        <header className="modal-head">
          <h3>{title}</h3>
          <button className="modal-x" onClick={onClose} aria-label="关闭">×</button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export function Empty({ icon = '🌱', children }) {
  return <div className="empty"><span className="empty-icon">{icon}</span><p>{children}</p></div>
}

export function Field({ label, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  )
}

// 带提交缓冲的输入框：打字中间态留在本地，停顿 300ms / 回车 / 失焦才提交 onCommit。
// 用于预算、目标体重这类「onChange 直接 dispatch」的字段——否则每敲一个键就是
// 一次全局 dispatch → 全树重渲染 + 全量 localStorage 序列化。
export function LazyInput({ value, onCommit, ...rest }) {
  const [v, setV] = useState(value ?? '')
  const latest = useRef(v)
  const timer = useRef(null)
  useEffect(() => { setV(value ?? '') }, [value]) // 外部变更（导入/重置）时同步回显
  useEffect(() => () => clearTimeout(timer.current), [])
  const commit = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    onCommit(latest.current)
  }
  return (
    <input
      {...rest}
      value={v}
      onChange={(e) => {
        latest.current = e.target.value
        setV(e.target.value)
        clearTimeout(timer.current)
        timer.current = setTimeout(commit, 300)
      }}
      onKeyDown={(e) => { if (e.key === 'Enter') commit() }}
      onBlur={() => { if (timer.current) commit() }}
    />
  )
}

// ---------- 像素风确认框（替换原生 confirm，Promise 用法与 window.confirm 对齐） ----------
// const ok = await confirmBox({ title, message, danger })
export function confirmBox({ title = '确认一下', message = '', danger = false, okText = '确定' }) {
  return new Promise((resolve) => emit('confirm', { title, message, danger, okText, resolve }))
}

export function ConfirmHost() {
  const [cur, setCur] = useState(null)
  const curRef = useRef(null) // 并发的第二个 confirm 进来时，先把前一个的 Promise 放行（视为取消），不让它永远悬空
  useEffect(() => on('confirm', (e) => {
    if (curRef.current) curRef.current.resolve(false)
    curRef.current = e.detail
    setCur(e.detail)
  }), [])
  const close = (val) => {
    if (!curRef.current) return
    setCur(null)
    curRef.current.resolve(val)
    curRef.current = null
  }
  return (
    <Modal open={!!cur} onClose={() => close(false)} title={cur?.title || '确认一下'}>
      <p className="confirm-msg">{cur?.message}</p>
      <div className="modal-foot">
        <Btn onClick={() => close(false)}>取消</Btn>
        <Btn color={cur?.danger ? 'red' : 'green'} onClick={() => close(true)}>{cur?.okText || '确定'}</Btn>
      </div>
    </Modal>
  )
}
