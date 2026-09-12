/* 云函数 sync —— 自动双向同步 + 快照
   action:
    push      {token, data:{key:{records:{id:rec}}}}  推送本地数据（服务端按记录 updatedAt 新者胜合并）
    pull      {token, since} → 全量数据（个人量级直接全量拉，客户端按 updatedAt 做记录级合并）
    snapshot  {token, data, tag}   手动备份（每日自动快照由客户端 push 前顺带做也行，这里只做手动）
    snapshots {token} → 快照列表
    restore   {token, ts} → 读某快照
   身份：token = hmac(密码+盐)，同一密码共享同一数据空间（uid 即 token 哈希）。 */
const cloud = require('@cloudbase/node-sdk')
const crypto = require('crypto')

const app = cloud.init({ env: cloud.SYMBOL_CURRENT_ENV })
const db = app.database()
const SALT = 'pt-gate-salt-2026'

const hmac = (str) => crypto.createHmac('sha256', SALT).update(str).digest('hex').slice(0, 32)
const uid = (token) => 'u' + hmac(token).slice(0, 12)

async function getUserDoc(uidv) {
  const coll = db.collection('pt_data')
  const rec = (await coll.where({ uid: uidv }).limit(1).get()).data[0]
  return rec
}

exports.main = async function (event) {
  const body = typeof event === 'string' ? JSON.parse(event || '{}') : (event || {})
  const action = body.action
  const token = String(body.token || '')
  if (!token) return { ok: false, message: '未登录' }
  const u = uid(token)
  const now = Date.now()

  try {
    if (action === 'push') {
      const data = body.data || {}
      let doc = await getUserDoc(u)
      if (!doc) {
        await db.collection('pt_data').add({ uid: u, data: {}, updatedAt: now })
        doc = await getUserDoc(u)
      }
      const remote = doc.data || {}
      let merged = 0
      for (const key of Object.keys(data)) {
        const incoming = data[key].records || {}
        const cur = remote[key] || { records: {} }
        for (const id of Object.keys(incoming)) {
          const r = incoming[id]
          const old = cur.records[id]
          // 新者胜：相等时间戳视为同一条数据，落谁都是一样的内容
          if (!old || (r.updatedAt || 0) >= (old.updatedAt || 0)) {
            cur.records[id] = r
            merged++
          }
        }
        remote[key] = cur
      }
      await db.collection('pt_data').doc(doc._id).update({ data: remote, updatedAt: now })
      return { ok: true, merged }
    }

    if (action === 'pull') {
      const doc = await getUserDoc(u)
      if (!doc) return { ok: true, data: {}, serverTime: now }
      return { ok: true, data: doc.data || {}, serverTime: doc.updatedAt || now }
    }

    if (action === 'snapshot') {
      await db.collection('pt_snapshots').add({
        uid: u, ts: now, tag: String(body.tag || '').slice(0, 30),
        size: JSON.stringify(body.data || {}).length,
        data: body.data || {},
      })
      // 只留最近 30 个快照（skip 30 拿第 31 条以后的，全删）
      const snaps = (await db.collection('pt_snapshots').where({ uid: u })
        .orderBy('ts', 'desc').skip(30).limit(100).get()).data
      for (const s of snaps) { await db.collection('pt_snapshots').doc(s._id).remove() }
      return { ok: true, ts: now }
    }

    if (action === 'snapshots') {
      const snaps = (await db.collection('pt_snapshots').where({ uid: u })
        .orderBy('ts', 'desc').limit(30).get()).data
      return { ok: true, list: snaps.map((s) => ({ ts: s.ts, tag: s.tag, size: s.size })) }
    }

    if (action === 'restore') {
      const snaps = (await db.collection('pt_snapshots').where({ uid: u, ts: Number(body.ts) || 0 })
        .limit(1).get()).data
      if (!snaps.length) return { ok: false, message: '快照不存在' }
      return { ok: true, data: snaps[0].data }
    }

    return { ok: false, message: '未知 action' }
  } catch (e) {
    return { ok: false, message: '服务异常: ' + e.message }
  }
}
