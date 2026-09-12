/* 云函数 gate —— 访问密码校验（首次自设，服务端存哈希）
   POST {password} → {ok, token}
   token = hmac(password + salt)，之后所有 sync 请求带 token 即身份（同一密码同一数据空间）。
   部署：见仓库 README「多端同步」一节（CloudBase 控制台或 cloudbase framework 部署）。 */
const cloud = require('@cloudbase/node-sdk')
const crypto = require('crypto')

const app = cloud.init({ env: cloud.SYMBOL_CURRENT_ENV })
const db = app.database()
const SALT = 'pt-gate-salt-2026'

const hmac = (str) => crypto.createHmac('sha256', SALT).update(str).digest('hex').slice(0, 32)

exports.main = async function (event) {
  // HTTP 访问集成：event 为解析后的 body
  const body = typeof event === 'string' ? JSON.parse(event || '{}') : (event || {})
  const password = String(body.password || '').trim()
  if (password.length < 4) return { ok: false, message: '密码至少 4 位' }

  const coll = db.collection('pt_auth')
  const rec = (await coll.limit(1).get()).data[0]

  if (!rec) {
    // 首次使用：设定密码
    await coll.add({ pwdHash: hmac(password), createdAt: Date.now() })
    return { ok: true, token: hmac(password + ':pt'), first: true }
  }
  if (rec.pwdHash === hmac(password)) {
    return { ok: true, token: hmac(password + ':pt') }
  }
  return { ok: false, message: '密码不对，再想想' }
}
