export const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export const dayKey = (d = new Date()) => {
  const x = d instanceof Date ? d : new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

export const parseKey = (k) => new Date(`${k}T00:00:00`)

export const addDays = (k, n) =>
  dayKey(new Date(parseKey(k).getTime() + n * 86400000))

export const lastNDays = (n, end = dayKey()) =>
  Array.from({ length: n }, (_, i) => addDays(end, i - (n - 1)))

export const monthKey = (k = dayKey()) => k.slice(0, 7)

export const fmtShort = (k) => `${parseKey(k).getMonth() + 1}/${parseKey(k).getDate()}`

export const fmtLong = (k) => {
  const d = parseKey(k)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 · 星期${WEEKDAYS[d.getDay()]}`
}

export const greeting = () => {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 12) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
}

// 小镇时段：清晨 / 白天 / 黄昏 / 夜晚（驱动 body[data-period] 换天）
export const timeOfDay = () => {
  const h = new Date().getHours()
  if (h < 6) return 'night'
  if (h < 8) return 'dawn'
  if (h < 17) return 'day'
  if (h < 19) return 'dusk'
  return 'night'
}

export const daysBetween = (a, b) =>
  Math.round((parseKey(b).getTime() - parseKey(a).getTime()) / 86400000)

// end 所在周的周一（周一是这一周的第一天）
export const weekKey = (end = dayKey()) =>
  addDays(end, -((parseKey(end).getDay() + 6) % 7))

// 稳定的伪随机（同一 key 每天结果一致），用于每日天气/语录
export const hashOf = (str) => {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

export const pickByDay = (arr, salt = '') => {
  const k = dayKey() + salt
  return arr[hashOf(k) % arr.length]
}
