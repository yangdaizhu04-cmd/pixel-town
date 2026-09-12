// ---------- 中文日期词解析（命令面板快速捕捉用） ----------
// 「明天交报告」→ { day: 明天的 key, clean: '交报告' }；解析不出日期时 day 为 null。
// todayKey 参数可注入（测试用），缺省是今天。规则与 workbench 的 parseDateWords 同源，
// 语义按小镇口径：周X = 未来最近的那个周X（含今天），下周X = 再往后推一周。
import { dayKey, addDays, parseKey } from './dates.js'

const CN_NUM = '一二三四五六日天'
const DAY = 86400000

export function parseDateWords(text, todayKey = dayKey()) {
  let clean = String(text || '').trim()
  let day = null
  const today = parseKey(todayKey)
  // 统一用「周一 = 0」的口径算周几（getDay() 是周日 = 0，直接混用会差一位）
  const cur = (today.getDay() + 6) % 7
  const wantOf = (ch) => {
    const i = CN_NUM.indexOf(ch)
    return i === 7 ? 6 : i // 「日」「天」都是周日（6）
  }
  const eat = (re, fn) => {
    const m = clean.match(re)
    if (m) {
      const r = fn(m)
      if (r) { day = r; clean = clean.replace(m[0], '').trim() }
    }
  }
  // 相对天：今天 / 明天 / 后天 / 大后天（前缀匹配，避免「明天性」这种词被切）
  eat(/^今天/, () => todayKey)
  eat(/^明天/, () => addDays(todayKey, 1))
  eat(/^后天/, () => addDays(todayKey, 2))
  eat(/^大后天/, () => addDays(todayKey, 3))
  // 下周X：严格指下一周（want - cur + 7，恒在 1~13 天后）
  eat(/^下周([一二三四五六日天])/, (m) =>
    dayKey(new Date(today.getTime() + (wantOf(m[1]) - cur + 7) * DAY)))
  // 周X / 星期X / 礼拜X：未来最近（今天也算）
  eat(/^(?:周|星期|礼拜)([一二三四五六日天])/, (m) => {
    let add = wantOf(m[1]) - cur
    if (add < 0) add += 7
    return dayKey(new Date(today.getTime() + add * DAY))
  })
  // M月D日 / M月D号：今年已过则算明年
  eat(/^(\d{1,2})月(\d{1,2})[日号]/, (m) => {
    const y = today.getFullYear()
    let d = new Date(y, +m[1] - 1, +m[2])
    if (d.getTime() < today.getTime()) d = new Date(y + 1, +m[1] - 1, +m[2])
    return dayKey(d)
  })
  return { day, clean }
}

// 「账 25 午饭」「账 12.5 奶茶」→ { amount, note }；不是记账格式返回 null
export function parseLedgerCapture(text) {
  const m = String(text || '').trim().match(/^账\s+(\d+(?:\.\d+)?)\s*(.*)$/)
  if (!m) return null
  const amount = +m[1]
  if (!(amount > 0)) return null
  return { amount, note: m[2].trim() || '随手记的一笔' }
}
