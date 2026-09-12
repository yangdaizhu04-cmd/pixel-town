// ---------- 云同步引擎（可选开，部署到自己的 CloudBase） ----------
// 协议与实现参考 personal-workbench 的 sync/gate 云函数（同一作者），按小镇存档结构调整：
// - 列表型切片（待办/账单/习惯/计划/目标/回收站/体重/专注记录）：记录级 LWW，每条按自己的 updatedAt 新者胜
// - reviews：按「天」作为记录粒度合并（id=日期 key）
// - 其余 KV 型切片（profile/english/budgets/claimed/xpLog/settings）：整块 LWW，时间戳取 state._touched[key]
// - 删除传播靠回收站墓碑：A 删除 → 墓碑推上云 → B 拉取后按墓碑删掉本地同 id 记录；
//   「恢复」不打墓碑删条目而是打 restoredAt 标记，避免 A 恢复、B 墓碑又把记录删掉的死循环
// 纯函数（encodeState/applyPull/decodeSnapshot）与引擎（fetch/定时）分离，前者全部有单测。

const LISTS = {
  todos: { prepend: true },
  ledger: { prepend: true },
  habits: {},
  study: {},
  goals: {},
  trash: { prepend: true },
  weights: { sortDay: true },
  pomoLog: { idOf: (r) => String(r.t), cap: 200 },
}
const MAPDAY = ['reviews']
// settings 里的密钥永远不上云（与导出备份同一口径）
const KV_STRIP = { settings: ['apiKey', 'webdavPass'] }
const KVS = ['profile', 'settings', 'english', 'budgets', 'claimed', 'xpLog']
const TRASH_KIND_COL = {
  todo: 'todos', ledger: 'ledger', habit: 'habits', study: 'study', goal: 'goals', weight: 'weights',
}

const rid = (r, idOf) => String(idOf ? idOf(r) : r.id ?? '')
const kvTs = (s, key) => (s._touched && s._touched[key]) || 0

// ---------- 编码：本地 state → 同步格式 { key: { records: { id: rec } } } ----------
export function encodeState(state) {
  const out = {}
  for (const [key, cfg] of Object.entries(LISTS)) {
    const records = {}
    for (const r of state[key] || []) records[rid(r, cfg.idOf)] = r
    out[key] = { records }
  }
  for (const key of MAPDAY) {
    const records = {}
    for (const [day, r] of Object.entries(state[key] || {})) records[day] = { ...r, id: day }
    out[key] = { records }
  }
  for (const key of KVS) {
    const val = state[key] ?? {}
    const stripped = { ...val }
    for (const f of KV_STRIP[key] || []) delete stripped[f]
    out[key] = { records: { __kv: { ...stripped, id: '__kv', updatedAt: kvTs(state, key) } } }
  }
  return out
}

// ---------- 合并：拉到的远端数据并进本地 state（纯函数） ----------
export function applyPull(state, data) {
  let s = state
  let changed = false
  const take = (key, col) => {
    s = { ...s, [key]: col }
  }

  for (const key of Object.keys(LISTS)) {
    const incoming = data?.[key]?.records || {}
    if (!Object.keys(incoming).length) continue
    const cfg = LISTS[key]
    const cur = s[key] || []
    const map = new Map(cur.map((r) => [rid(r, cfg.idOf), r]))
    let touched = false
    for (const [id, rec] of Object.entries(incoming)) {
      const old = map.get(id)
      if (!old || (rec.updatedAt || 0) > (old.updatedAt || 0)) { map.set(id, rec); touched = true }
    }
    if (!touched) continue
    let merged = cur.map((r) => {
      const id = rid(r, cfg.idOf)
      const rec = map.get(id)
      return rec === undefined ? r : (rec.updatedAt || 0) >= (r.updatedAt || 0) ? rec : r
    })
    // 新记录按各集合原本的插入语义落位
    const known = new Set(cur.map((r) => rid(r, cfg.idOf)))
    const adds = Object.entries(incoming).filter(([id]) => !known.has(id)).map(([, r]) => r)
    merged = cfg.prepend ? [...adds, ...merged] : [...merged, ...adds]
    if (cfg.sortDay) merged.sort((a, b) => (a.day < b.day ? -1 : 1))
    if (cfg.cap) merged = merged.slice(-cfg.cap)
    take(key, merged)
    changed = true
  }

  for (const key of MAPDAY) {
    const incoming = data?.[key]?.records || {}
    if (!Object.keys(incoming).length) continue
    const cur = s[key] || {}
    let next = null
    for (const [day, rec] of Object.entries(incoming)) {
      const old = cur[day]
      if (!old || (rec.updatedAt || 0) > (old.updatedAt || 0)) {
        if (!next) next = { ...cur }
        const { id: _id, ...rest } = rec
        next[day] = rest
      }
    }
    if (next) { take(key, next); changed = true }
  }

  for (const key of KVS) {
    const kv = data?.[key]?.records?.__kv
    if (!kv) continue
    const incTs = kv.updatedAt || 0
    if (incTs <= kvTs(s, key)) continue
    const { id: _id, updatedAt: _ts, ...fields } = kv
    // settings 的密钥不在同步数据里：合并而不是整块替换，本地已配置的 Key 不会被清掉
    s = { ...s, [key]: { ...s[key], ...fields } }
    s = { ...s, _touched: { ...(s._touched || {}), [key]: incTs } }
    changed = true
  }

  // 墙碑应用：扫合并后的回收站，把「未恢复的删除记录」用于删掉本地更旧的同 id 记录
  for (const ent of s.trash || []) {
    if (!ent || ent.restoredAt) continue
    const col = TRASH_KIND_COL[ent.kind]
    if (!col || !s[col]) continue
    const before = s[col].length
    const filtered = s[col].filter((r) => {
      const id = rid(r, LISTS[col].idOf)
      return !(String(id) === String(ent.refId) && (r.updatedAt || 0) <= (ent.updatedAt || 0))
    })
    if (filtered.length !== before) { take(col, filtered); changed = true }
  }

  return { state: s, changed }
}

// ---------- 快照解码：同步格式 → 存档形状（交给 hydrate 补齐兜底） ----------
export function decodeSnapshot(data) {
  const out = {}
  for (const [key, payload] of Object.entries(data || {})) {
    const records = payload?.records || {}
    if (LISTS[key]) out[key] = Object.values(records)
    else if (MAPDAY.includes(key)) {
      out[key] = Object.fromEntries(Object.entries(records).map(([day, r]) => {
        const { id: _id, ...rest } = r
        return [day, rest]
      }))
    } else if (KVS.includes(key)) {
      const kv = records.__kv
      if (kv) {
        const { id: _id, updatedAt: _ts, ...fields } = kv
        out[key] = fields
      }
    }
  }
  return out
}

// ---------- 引擎（副作用：fetch / 定时 / localStorage token） ----------
const TOKEN_KEY = 'pixel-town-sync-token'
let commit = null // (data) => void，由 AppProvider 注册（dispatch SYNC_MERGE）
let latest = null
let pushTimer = null
let pullTimer = null
let busy = false
let status = 'off'
let lastSyncAt = 0
const statusSubs = new Set()

export const syncStatus = () => ({ status, lastSyncAt })
export const syncSubscribe = (f) => { statusSubs.add(f); return () => statusSubs.delete(f) }
function setStatus(s) {
  status = s
  statusSubs.forEach((f) => { try { f(syncStatus()) } catch { /* ignore */ } })
}

export const syncToken = () => {
  try { return localStorage.getItem(TOKEN_KEY) || '' } catch { return '' }
}
export const syncLogout = () => {
  try { localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ }
  clearInterval(pullTimer)
  pullTimer = null
  setStatus('off')
}

export function syncBind(fn) { commit = fn }
function touchLatest(state) { if (state) latest = state }

async function call(base, fn, payload) {
  const ctrl = new AbortController()
  const tid = setTimeout(() => ctrl.abort(), 20000)
  try {
    const res = await fetch(`${base.replace(/\/+$/, '')}/${fn}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(tid)
  }
}

// 密码换 token（首次会自动设定密码）
export async function syncGate(base, password) {
  const r = await call(base, 'gate', { password })
  if (!r.ok) throw new Error(r.message || '验证失败')
  try { localStorage.setItem(TOKEN_KEY, r.token) } catch { /* ignore */ }
  return r.token
}

export function syncEnabled(state) {
  return !!(state?.settings?.syncUrl && syncToken() && commit)
}

function schedulePush() {
  clearTimeout(pushTimer)
  pushTimer = setTimeout(() => { pushNow() }, 3000)
}

export async function pushNow() {
  if (busy || !latest || !syncEnabled(latest)) return
  busy = true
  setStatus('syncing')
  try {
    const r = await call(latest.settings.syncUrl, 'sync', { action: 'push', token: syncToken(), data: encodeState(latest) })
    if (!r.ok) throw new Error(r.message || 'push 失败')
    lastSyncAt = Date.now()
    setStatus('ok')
  } catch (e) {
    setStatus(`error:${e.message}`)
  }
  busy = false
}

export async function pullNow() {
  if (busy || !latest || !syncEnabled(latest)) return
  busy = true
  setStatus('syncing')
  try {
    const r = await call(latest.settings.syncUrl, 'sync', { action: 'pull', token: syncToken(), since: 0 })
    if (!r.ok) throw new Error(r.message || 'pull 失败')
    if (r.data && commit) {
      commit(r.data) // reducer 里走 applyPull，changed 时才会真正落 state
    }
    lastSyncAt = Date.now()
    setStatus('ok')
  } catch (e) {
    setStatus(`error:${e.message}`)
  }
  busy = false
}

export async function syncNow() {
  await pullNow()
  await pushNow()
}

// 云端快照：手动备份 / 列表 / 恢复（恢复由设置页拿到 data 后走 IMPORT 确认流程）
export async function syncSnapshot(state, tag) {
  const r = await call(state.settings.syncUrl, 'sync', { action: 'snapshot', token: syncToken(), data: encodeState(state), tag })
  if (!r.ok) throw new Error(r.message || '备份失败')
  lastSyncAt = Date.now()
  setStatus('ok')
  return r
}
export async function syncSnapshots(state) {
  const r = await call(state.settings.syncUrl, 'sync', { action: 'snapshots', token: syncToken() })
  if (!r.ok) throw new Error(r.message || '读取快照失败')
  return r.list || []
}
export async function syncRestore(state, ts) {
  const r = await call(state.settings.syncUrl, 'sync', { action: 'restore', token: syncToken(), ts })
  if (!r.ok) throw new Error(r.message || '快照不存在')
  return r.data
}

// AppProvider 接线：state 变化 → 记最新值 + 防抖 push；启动 → pull + 定时 pull + 联网恢复时 pull
export function syncOnState(state) {
  const was = syncEnabled(state)
  touchLatest(state)
  if (was) schedulePush()
}
export function syncInit() {
  if (typeof window === 'undefined') return () => {}
  const kick = () => { if (latest && syncEnabled(latest)) { setStatus('ok'); pullNow() } }
  const onOnline = () => { if (latest && syncEnabled(latest)) pullNow() }
  kick()
  pullTimer = setInterval(pullNow, 5 * 60 * 1000)
  window.addEventListener('online', onOnline)
  return () => {
    clearInterval(pullTimer)
    pullTimer = null
    window.removeEventListener('online', onOnline)
  }
}
