import React, { useEffect, useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { Panel, Btn, Empty, Chip } from '../components/ui.jsx'
import { PixelSprite } from '../lib/sprites.jsx'
import { fetchNews } from '../lib/news.js'
import { emit } from '../lib/gamify.js'
import { fmtShort } from '../lib/dates.js'

const SOURCE_COLORS = { 量子位: 'orange', 爱范儿: 'blue', InfoQ: 'gold', 'Hacker News': 'green', 内置精选: 'pink' }

export default function News() {
  const { state, dispatch } = useApp()
  const [loading, setLoading] = useState(false)

  const load = async (force = false) => {
    setLoading(true)
    const r = await fetchNews(force)
    dispatch({ type: 'NEWS_SET', items: r.items, cachedAt: r.cachedAt, source: r.source })
    setLoading(false)
    if (r.source === 'live') emit('toast', { icon: '📰', text: `小信鸽带回了 ${r.items.length} 条新鲜资讯` })
    if (r.source === 'fallback') emit('toast', { icon: '🕊️', text: '新闻源暂时够不着，上了一份内置精选' })
  }

  useEffect(() => {
    const stale = !state.news.items.length || Date.now() - state.news.cachedAt > 6 * 3600 * 1000
    if (stale && !loading) load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const items = state.news.items || []
  const offline = state.news.source === 'fallback'

  return (
    <Panel
      title="小镇日报 · AI 圈的新鲜事"
      icon="📰"
      extra={
        <div className="news-extra">
          {state.news.cachedAt > 0 && <Chip className={offline ? 'pink' : 'green'}>{offline ? '📦 内置精选' : `🕊️ 更新于 ${fmtShort(new Date(state.news.cachedAt).toISOString().slice(0, 10))}`}</Chip>}
          <Btn size="sm" disabled={loading} onClick={() => load(true)}>{loading ? '飞行中…' : '↻ 刷新'}</Btn>
        </div>
      }
    >
      <p className="muted">小信鸽每天飞去量子位、爱范儿、InfoQ 和 Hacker News 抓 AI 新鲜事；抓不到时就从口袋里掏出内置精选（不联网也能看）。</p>

      {loading && items.length === 0 && (
        <div className="news-loading">
          <PixelSprite name="mail" scale={6} className="bob" />
          <p>小信鸽正在飞回来的路上……</p>
        </div>
      )}

      {items.length === 0 && !loading && <Empty icon="📰">点击「刷新」让小信鸽出动！</Empty>}

      <ul className="news-list">
        {items.map((n, i) => (
          <li key={`${n.title}-${i}`} className="card news-item">
            <div className="news-meta">
              <Chip color={SOURCE_COLORS[n.source] || ''}>{n.source}</Chip>
              {n.date && <span className="news-date">{n.date}</span>}
            </div>
            <h4 className="news-title">
              {n.url ? <a href={n.url} target="_blank" rel="noreferrer">{n.title} ↗</a> : n.title}
            </h4>
            {n.summary && <p className="news-summary">{n.summary}</p>}
          </li>
        ))}
      </ul>
    </Panel>
  )
}
