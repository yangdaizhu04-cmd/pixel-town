import React from 'react'
import { useApp, TRASH_DAYS } from '../lib/store.jsx'
import { Modal, Btn, Chip, Empty, confirmBox } from './ui.jsx'
import { sfx, emit } from '../lib/gamify.js'
import { dayKey, fmtShort } from '../lib/dates.js'

const KIND_META = {
  todo: { icon: '📝', name: '待办', title: (d) => d.text },
  ledger: { icon: '💰', name: '账单', title: (d) => `${d.note || '账单'} ¥${d.amount}` },
  habit: { icon: '✅', name: '习惯', title: (d) => `${d.icon || ''} ${d.name}` },
  study: { icon: '📚', name: '学习计划', title: (d) => d.title },
  goal: { icon: '🎯', name: '月目标', title: (d) => d.text },
  weight: { icon: '⚖️', name: '体重', title: (d) => `${d.kg}kg（${d.day}）` },
}

// 回收站：软删除的记录在这里躺 30 天，可恢复可彻底删除。
// 「彻底删除」只清掉本机的墓碑——如果开着云同步，其他设备会在各自的保留期到点后自动清。
export default function TrashModal({ open, onClose }) {
  const { state, dispatch } = useApp()
  const items = state.trash || []

  const restore = (ent) => {
    dispatch({ type: 'TRASH_RESTORE', id: ent.id })
    sfx('check')
    emit('toast', { icon: '♻️', text: `已恢复${KIND_META[ent.kind] ? `：${KIND_META[ent.kind].title(ent.data) || ''}` : ''}` })
  }
  const purge = async (ent) => {
    const ok = await confirmBox({ title: '彻底删除', message: '彻底删除后无法再恢复，确定吗？', danger: true, okText: '删除' })
    if (!ok) return
    dispatch({ type: 'TRASH_PURGE', id: ent.id })
    sfx('oops')
  }
  const empty = async () => {
    const ok = await confirmBox({ title: '清空回收站', message: `把 ${items.length} 条记录全部彻底删除？此操作无法撤销。`, danger: true, okText: '全部删除' })
    if (!ok) return
    dispatch({ type: 'TRASH_EMPTY' })
    sfx('oops')
  }

  const daysLeft = (ent) => Math.max(0, TRASH_DAYS - Math.floor((Date.now() - (ent.updatedAt || 0)) / 86400000))

  return (
    <Modal open={open} onClose={onClose} title={`🗑️ 回收站（${items.length}）`}>
      <p className="settings-hint">删除的待办 / 账单 / 习惯 / 计划 / 目标 / 体重会先躺在这里 {TRASH_DAYS} 天，误删了随时捡回来。</p>
      {items.length === 0 ? (
        <Empty icon="🗑️">回收站空空的，你的记录都好好的。</Empty>
      ) : (
        <ul className="trash-list">
          {items.map((ent) => {
            const meta = KIND_META[ent.kind] || { icon: '❔', name: '记录', title: () => '' }
            return (
              <li key={ent.id} className={`trash-item card ${ent.restoredAt ? 'restored' : ''}`}>
                <span className="trash-icon">{meta.icon}</span>
                <div className="trash-main">
                  <span className="trash-title">{meta.title(ent.data) || meta.name}</span>
                  <span className="trash-sub">
                    {meta.name} · {fmtShort(dayKey(new Date(ent.deletedAt)))} 删除
                    {ent.restoredAt ? ' · 已恢复过' : ''}
                  </span>
                </div>
                {ent.restoredAt
                  ? <Chip color="green">已在清单中</Chip>
                  : <Chip color={daysLeft(ent) <= 7 ? 'orange' : ''}>剩 {daysLeft(ent)} 天</Chip>}
                {!ent.restoredAt && <Btn size="sm" color="green" onClick={() => restore(ent)}>恢复</Btn>}
                <Btn size="sm" color="red" onClick={() => purge(ent)}>彻底删除</Btn>
              </li>
            )
          })}
        </ul>
      )}
      {items.length > 0 && (
        <div className="btn-row">
          <Btn color="red" onClick={empty}>清空回收站</Btn>
        </div>
      )}
    </Modal>
  )
}
