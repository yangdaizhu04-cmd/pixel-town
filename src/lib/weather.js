// ---------- 真实天气：open-meteo（免费、无需 Key、支持 CORS） ----------
// 两种来源：
//   1) 指定城市：城市名 → geocoding 拿经纬度 → forecast 拿 WMO weathercode
//   2) 跟随定位：浏览器定位拿经纬度 → forecast；城市名用 BigDataCloud 免费逆地理编码
// 缓存 2 小时，key 区分来源；失败一律返回 null，由调用方回退到本地伪随机天气。
// 每个子 key（geo / city:xx）各占一个 localStorage 条目，恢复具体的城市就不会互相挤掉。
import { cacheRead, cacheWrite } from './cache.js'

const CACHE_KEY = 'pixel-town-weather-v1'
const GEO_KEY = 'pixel-town-geo-v1' // 最近一次定位坐标（30 分钟内复用，避免反复弹权限）
const MAX_AGE = 2 * 3600 * 1000
const GEO_TTL = 30 * 60 * 1000

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

const weatherRead = (key) => cacheRead(`${CACHE_KEY}:${key}`, MAX_AGE)?.data ?? null
const weatherWrite = (key, data) => cacheWrite(`${CACHE_KEY}:${key}`, data)

async function fetchForecast(lat, lon, signal) {
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`, { signal })
  const wx = await res.json()
  return wx.current_weather || null
}

// 逆地理编码：坐标 → 城市显示名（BigDataCloud 免费客户端接口，无需 Key）
async function reverseGeocode(lat, lon, signal) {
  try {
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=zh`, { signal })
    const g = await res.json()
    return g.city || g.locality || g.principalSubdivision || '你的位置'
  } catch {
    return '你的位置'
  }
}

// ---------- 跟随定位 ----------
export async function fetchWeatherByGeo() {
  const key = 'geo'
  const cached = weatherRead(key)
  if (cached) return cached

  // 30 分钟内的定位坐标直接复用，避免每次进首页都弹权限/等定位
  let lat = null
  let lon = null
  try {
    const g = JSON.parse(localStorage.getItem(GEO_KEY))
    if (g && Date.now() - g.at < GEO_TTL) { lat = g.lat; lon = g.lon }
  } catch { /* ignore */ }

  if (lat == null) {
    // 用户拒绝授权 / 定位超时会 reject：必须吞掉返回 null，由调用方回退「小镇预言」（否则逃逸成 unhandledrejection）
    try {
      const pos = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) { reject(new Error('NO_GEO')); return }
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000, maximumAge: 10 * 60 * 1000 })
      })
      lat = pos.coords.latitude
      lon = pos.coords.longitude
    } catch {
      return null
    }
    try { localStorage.setItem(GEO_KEY, JSON.stringify({ at: Date.now(), lat, lon })) } catch { /* ignore */ }
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 9000)
  try {
    const cur = await fetchForecast(lat.toFixed(3), lon.toFixed(3), ctrl.signal)
    if (!cur) return null
    const sprite = codeToSprite(cur.weathercode)
    const data = {
      sprite,
      name: NAME[sprite],
      copy: COPY[sprite],
      temp: Math.round(cur.temperature),
      city: await reverseGeocode(lat, lon, ctrl.signal),
      live: true,
    }
    weatherWrite(key, data)
    return data
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// ---------- 指定城市 ----------
export async function fetchWeatherByCity(city) {
  const c = (city || '').trim()
  if (!c) return null
  const key = `city:${c}`
  const cached = weatherRead(key)
  if (cached) return cached

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  try {
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(c)}&count=1&language=zh&format=json`, { signal: ctrl.signal })
    const geo = await geoRes.json()
    const loc = geo.results && geo.results[0]
    if (!loc) return null
    const cur = await fetchForecast(loc.latitude, loc.longitude, ctrl.signal)
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
    weatherWrite(key, data)
    return data
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
