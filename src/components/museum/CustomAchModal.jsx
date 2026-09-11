import React, { useState } from 'react'
import { useDispatch } from '../../lib/store.jsx'
import { Modal, Btn, Field } from '../ui.jsx'
import { ACH_METRICS } from '../../lib/achievements.js'
import { sfx } from '../../lib/gamify.js'

// ---------- 新建自定义成就 ----------
export default function CustomAchModal({ open, onClose }) {
  const dispatch = useDispatch()
  const [name, setName] = useState('')
  const [metric, setMetric] = useState('todosDone')
  const [target, setTarget] = useState(10)
  const [coins, setCoins] = useState(10)

  const add = () => {
    const n = name.trim()
    if (!n) return
    if (metric !== 'manual' && target < 1) return
    dispatch({
      type: 'ACH_CUSTOM_ADD',
      meta: {
        name: n,
        metric,
        target: metric === 'manual' ? 0 : Math.max(1, Math.round(target)),
        coins: Math.max(0, Math.min(60, Math.round(coins))),
      },
    })
    sfx('pop')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="🎯 自定义成就">
      <div className="field-stack">
        <Field label="成就名称（想庆祝的那件事）">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：读完 10 本书" autoFocus />
        </Field>
        <Field label="达成方式">
          <select value={metric} onChange={(e) => setMetric(e.target.value)}>
            {ACH_METRICS.map((m) => <option key={m.id} value={m.id}>{m.icon} {m.label}</option>)}
            <option value="manual">🕯️ 手动点亮（自己的心愿）</option>
          </select>
        </Field>
        {metric !== 'manual' && (
          <Field label="目标值">
            <input type="number" min={1} value={target} onChange={(e) => setTarget(Number(e.target.value))} />
          </Field>
        )}
        <Field label="解锁奖励金币（0-60）">
          <input type="number" min={0} max={60} value={coins} onChange={(e) => setCoins(Number(e.target.value))} />
        </Field>
        <p className="muted">计数型成就达到目标会自动解锁；手动心愿则由你亲手点亮。</p>
      </div>
      <div className="modal-foot">
        <Btn onClick={onClose}>再想想</Btn>
        <Btn color="green" onClick={add} disabled={!name.trim()}>建立成就</Btn>
      </div>
    </Modal>
  )
}
