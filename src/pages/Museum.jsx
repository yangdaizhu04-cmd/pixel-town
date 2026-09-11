import React, { useMemo, useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { Panel, Btn, Empty, confirmBox } from '../components/ui.jsx'
import { PLANT_META } from '../lib/shop.js'
import { sfx, emit } from '../lib/gamify.js'
import { weeklyReport } from '../lib/weekly.js'
import Heatmap from '../components/museum/Heatmap.jsx'
import PomoWall from '../components/museum/PomoWall.jsx'
import DexGrid from '../components/museum/DexGrid.jsx'
import TrophyWall from '../components/museum/TrophyWall.jsx'
import CustomAchModal from '../components/museum/CustomAchModal.jsx'
import ShareCard from '../components/museum/ShareCard.jsx'
import { ACHIEVEMENTS } from '../lib/achievements.js'

// 环比小箭头：正/负/持平
const Delta = ({ v, unit = '' }) =>
  v > 0 ? <span className="w-diff up">↗ {v}{unit}</span>
    : v < 0 ? <span className="w-diff down">↘ {Math.abs(v)}{unit}</span>
      : <span className="w-diff">—</span>

// ---------- 上周小镇周报 ----------
// report 由父组件算好传入：Museum 主体和这里各自调一次 weeklyReport 会把两周数据聚合两遍
function WeeklyReport({ report }) {
  const r = report
  const w = r.thisWeek
  const cells = [
    { icon: '📝', label: '完成待办', value: `${w.todos} 件`, d: r.diff.todos, unit: '' },
    { icon: '✅', label: '习惯点亮', value: `${w.habits} 次`, d: r.diff.habits, unit: '' },
    { icon: '🍅', label: '专注时长', value: `${w.focusMin} 分钟`, d: r.diff.focusMin, unit: 'm' },
    { icon: '🧾', label: '记一笔账', value: `${w.ledger} 笔`, d: r.diff.ledger, unit: '' },
    { icon: '🌙', label: '晚间复盘', value: `${w.reviews} 篇`, d: r.diff.reviews, unit: '' },
    { icon: '💰', label: '本周收入', value: `¥${w.income}`, d: w.income - r.lastWeek.income, unit: '' },
    { icon: '💸', label: '本周支出', value: `¥${w.expense}`, d: w.expense - r.lastWeek.expense, unit: '' },
    { icon: '⭐', label: '小镇热度', value: `${w.xp} XP`, d: r.diff.xp, unit: '' },
  ]
  return (
    <div className="week-stats">
      {cells.map((c) => (
        <div key={c.label} className="week-stat">
          <span className="ws-icon">{c.icon}</span>
          <b>{c.value}</b>
          <span className="ws-label">{c.label}</span>
          <Delta v={c.d} unit={c.unit} />
        </div>
      ))}
    </div>
  )
}

export default function Museum() {
  const { state, dispatch } = useApp()
  const [achOpen, setAchOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  // 打开弹窗等本页 setState 不应触发重新聚合两周数据
  const report = useMemo(() => weeklyReport(state), [state])
  const totalXp = useMemo(() => Object.values(state.xpLog || {}).reduce((m, x) => m + x, 0), [state.xpLog])
  const customAch = state.profile.customAch || []
  const achCount = Object.keys(state.profile.achievements || {}).length

  const claim = async (a) => {
    if (await confirmBox({ title: '点亮心愿', message: `点亮「${a.name}」拿 ${a.coins} 金币？\n点亮后不可撤销（宽恕优先，想反悔就再建一个 😉）` })) {
      dispatch({ type: 'ACH_UNLOCK', id: a.id, coins: a.coins })
      sfx('coin')
      emit('toast', { icon: '🏆', text: `点亮成就「${a.name}」！+${a.coins} 金币` })
    }
  }

  const del = async (a) => {
    if (await confirmBox({ title: '删除自定义成就', message: `删除「${a.name}」？解锁记录也会一起清掉`, danger: true, okText: '删除' })) {
      dispatch({ type: 'ACH_CUSTOM_DEL', id: a.id })
      sfx('oops')
    }
  }

  return (
    <>
      <Panel
        title="上周小镇周报" icon="🗞️"
        extra={<span className="xp-pill">本周 {report.days[0].slice(5).replace('-', '/')} 起</span>}
      >
        <div className="week-stats-wrap">
          <WeeklyReport report={report} />
          <p className="muted">自动生成的本周小结，箭头是和上周比（↗ 变好 / ↘ 变少）。过去 7 天的努力都算数。</p>
        </div>
      </Panel>

      <Panel
        title="小镇半年鉴" icon="🗺️"
        extra={
          <div className="btn-row">
            <span className="xp-pill">历史累计 {totalXp} XP</span>
            <Btn size="sm" color="gold" onClick={() => setShareOpen(true)}>📸 分享卡</Btn>
          </div>
        }
      >
        <p className="muted">每一格是一天：颜色越亮，那天的小镇越热闹。金色是冲破 90 XP 的日子！</p>
        <Heatmap xpLog={state.xpLog} />
      </Panel>

      <Panel
        title="专注番茄田" icon="🍅"
        extra={<span className="xp-pill">累计 {state.profile.stats?.pomos || 0} 颗</span>}
      >
        <PomoWall state={state} />
      </Panel>

      <Panel
        title="植物图鉴" icon="🌻"
        extra={<span className="xp-pill">{(state.profile.collection || []).length} / {PLANT_META.length} 收集</span>}
      >
        {(state.profile.collection || []).length === 0
          ? <Empty icon="🌱">还没有植物盛开。完成任务会自动浇水，盛开的那一刻会记在这里。</Empty>
          : <DexGrid state={state} />}
      </Panel>

      <Panel
        title="成就奖杯墙" icon="🏆"
        extra={
          <div className="btn-row">
            <span className="xp-pill">{achCount} / {ACHIEVEMENTS.length + customAch.length} 枚奖杯</span>
            <Btn size="sm" color="gold" onClick={() => setAchOpen(true)}>＋ 自定义成就</Btn>
          </div>
        }
      >
        <TrophyWall state={state} onClaim={claim} onDel={del} />
      </Panel>

      <CustomAchModal open={achOpen} onClose={() => setAchOpen(false)} />
      <ShareCard state={state} open={shareOpen} onClose={() => setShareOpen(false)} />
    </>
  )
}
