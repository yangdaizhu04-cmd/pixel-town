// ---------- WebDAV 云备份（坚果云 / 群晖 / Nextcloud 等） ----------
// 浏览器直连的限制：是否可用取决于网盘是否放行 CORS。
// 坚果云实测放行（Access-Control-Allow-Origin: *）；若控制台报 CORS，说明该网盘不支持浏览器直连，
// 只能用「导出备份」手动存文件。详见踩坑指南对应条目。
import { dayKey } from './dates.js'

// Basic auth 的用户名密码可能是非 ASCII，先转 UTF-8 字节再 btoa
const authHeader = (user, pass) =>
  'Basic ' + btoa(unescape(encodeURIComponent(`${user}:${pass}`)))

const normUrl = (u) => {
  const s = (u || '').trim().replace(/\/+$/, '')
  // 只允许 http(s)：浏览器本来也发不了其他协议，这里提前给出人话报错
  if (!/^https?:\/\//i.test(s)) throw new Error('WebDAV 地址要以 http:// 或 https:// 开头')
  return s
}

export async function webdavUpload({ url, user, pass, content, filename }) {
  const res = await fetch(`${normUrl(url)}/${filename}`, {
    method: 'PUT',
    headers: { Authorization: authHeader(user, pass), 'Content-Type': 'application/json' },
    body: content,
  })
  if (!res.ok) throw new Error(`上传失败（HTTP ${res.status}）`)
  // 再按日期名写一份留档：就算以后固定名被新备份覆盖，云端也留着每天的历史版本；
  // 留档失败不阻主流程（有些网盘目录规则较严，能传最新一份就够恢复用）
  try {
    await fetch(`${normUrl(url)}/${datedBackupFilename()}`, {
      method: 'PUT',
      headers: { Authorization: authHeader(user, pass), 'Content-Type': 'application/json' },
      body: content,
    })
  } catch { /* 留档是锦上添花，失败可忽略 */ }
}

export async function webdavDownload({ url, user, pass, filename }) {
  const res = await fetch(`${normUrl(url)}/${filename}`, {
    method: 'GET',
    headers: { Authorization: authHeader(user, pass) },
  })
  if (res.status === 404) throw new Error('网盘上还没有备份文件')
  if (!res.ok) throw new Error(`下载失败（HTTP ${res.status}）`)
  return res.text()
}

// 固定名 = 「最新一份」，恢复时永远读它；日期名 = 每日留档，防止历史被覆盖
export const backupFilename = () =>
  `pixel-town-backup.json`

export const datedBackupFilename = () =>
  `pixel-town-backup-${dayKey()}.json`
