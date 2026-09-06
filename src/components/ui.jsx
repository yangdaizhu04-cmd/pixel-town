import React, { useEffect, useRef } from 'react'
import { gsap, D } from '../lib/anim.js'
import { sfx } from '../lib/gamify.js'

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
      onClick={(e) => { sfx('click'); onClick && onClick(e) }}
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
