// ---------- 真实天气：open-meteo（免费、无需 Key、支持 CORS） ----------
// 流程：城市名 → geocoding 拿经纬度 → forecast 拿 WMO weathercode；缓存 2 小时。
// 失败/未配置城市时返回 null，由调用方回退到本地伪随机天气。
const CACHE_KEY = 'pixel-town-weather-v1'
const MAX_AGE = 2 * 3600 * 1000

// WMO weathercode → 小镇天气精灵（0 晴 / 2-3 多云 / 其余雨雪都归到小雨）
function codeToSprite(code) {
  if (code <= 1) return 'sun'
  if (code <= 48) return 'cloud'
  return 'drop'
}
const NAME = { sun: '大晴天', cloud: '多云', drop: '有雨雪' }
const COPY = {
  sun: '真实的太阳也在天上，先完成一件小事，快乐会慢慢长出来。',
  cloud: '天上真的有云，你也别急，慢慢来。',
  drop: '外面真的在下雨，适合待在屋里，泡杯茶做点小事。',
}

export async function fetchWeather(city) {
  const c = (city || '').trim()
  if (!c) return null
  // 命中缓存直接回
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY))
    if (raw && raw.city === c && Date.now() - raw.at < MAX_AGE) return raw.data
  } catch { /* ignore */ }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  try {
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(c)}&count=1&language=zh&format=json`, { signal: ctrl.signal })
    const geo = await geoRes.json()
    const loc = geo.results && geo.results[0]
    if (!loc) return null
    const wxRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current_weather=true`, { signal: ctrl.signal })
    const wx = await wxRes.json()
    const cur = wx.current_weather
    if (!cur) return null
    const sprite = codeToSprite(cur.weathercode)
    const data = {
      sprite,
      name: NAME[sprite],
      copy: COPY[sprite],
      temp: Math.round(cur.temperature),
      city: loc.name,
      live: true,
    }
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), city: c, data })) } catch { /* ignore */ }
    return data
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
