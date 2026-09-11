// ---------- 每日诗词：诗泉免费 API + 每日缓存 + 内置兜底 ----------
// 数据源：https://poetry.palemoky.com/api/poems/random
//   · 37 万首古诗词库，免费、无需 Key、CORS 开放（2026-09-11 实测 Access-Control-Allow-Origin: *）
//   · 返回结构：{ data: { title, content: string[], author: { name }, dynasty: { name } } }
// 策略：每天首次进入拉取一首并缓存一天（缓存 key 带日期），跨天自动换新；
//       离线 / 接口异常时回退到内置名句（按当天日期伪随机选一首，同一天稳定不变）。
// 主句取整首诗的前两行（多数诗首联即是可读的一句），过长则退化成一行。
import { dayKey, hashOf } from './dates.js'

const CACHE_KEY = 'pixel-town-poem-v1'
const MAX_AGE = 24 * 3600 * 1000
export const POEM_API = 'https://poetry.palemoky.com/api/poems/random'
const SALT = ':poem'

export const POEMS_FALLBACK = [
  { text: '欲穷千里目，更上一层楼。', title: '登鹳雀楼', author: '王之涣', dynasty: '唐' },
  { text: '长风破浪会有时，直挂云帆济沧海。', title: '行路难', author: '李白', dynasty: '唐' },
  { text: '安得广厦千万间，大庇天下寒士俱欢颜。', title: '茅屋为秋风所破歌', author: '杜甫', dynasty: '唐' },
  { text: '谁言寸草心，报得三春晖。', title: '游子吟', author: '孟郊', dynasty: '唐' },
  { text: '野火烧不尽，春风吹又生。', title: '赋得古原草送别', author: '白居易', dynasty: '唐' },
  { text: '众里寻他千百度，蓦然回首，那人却在、灯火阑珊处。', title: '青玉案·元夕', author: '辛弃疾', dynasty: '宋' },
  { text: '千磨万击还坚劲，任尔东西南北风。', title: '竹石', author: '郑燮', dynasty: '清' },
  { text: '人生自古谁无死，留取丹心照汗青。', title: '过零丁洋', author: '文天祥', dynasty: '宋' },
  { text: '沉舟侧畔千帆过，病树前头万木春。', title: '酬乐天扬州初逢席上见赠', author: '刘禹锡', dynasty: '唐' },
  { text: '会当凌绝顶，一览众山小。', title: '望岳', author: '杜甫', dynasty: '唐' },
  { text: '少壮不努力，老大徒伤悲。', title: '长歌行', author: '佚名', dynasty: '汉' },
  { text: '落红不是无情物，化作春泥更护花。', title: '己亥杂诗', author: '龚自珍', dynasty: '清' },
  { text: '不识庐山真面目，只缘身在此山中。', title: '题西林壁', author: '苏轼', dynasty: '宋' },
  { text: '问渠那得清如许，为有源头活水来。', title: '观书有感', author: '朱熹', dynasty: '宋' },
  { text: '纸上得来终觉浅，绝知此事要躬行。', title: '冬夜读书示子聿', author: '陆游', dynasty: '宋' },
  { text: '忽如一夜春风来，千树万树梨花开。', title: '白雪歌送武判官归京', author: '岑参', dynasty: '唐' },
  { text: '明月松间照，清泉石上流。', title: '山居秋暝', author: '王维', dynasty: '唐' },
  { text: '空山不见人，但闻人语响。', title: '鹿柴', author: '王维', dynasty: '唐' },
]

// 长诗只取前两行做成题词，超长退化成一行，保证窄栏也能舒服地展示
function buildText(content) {
  const lines = (Array.isArray(content) ? content : [])
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .slice(0, 2)
  if (!lines.length) return ''
  const text = lines.join('\n')
  return text.length > 48 ? lines[0] : text
}

function toPoem(raw) {
  const d = raw && raw.data
  if (!d) return null
  const text = buildText(d.content)
  if (!text) return null
  return {
    text,
    title: (d.title || '').trim(),
    author: ((d.author && d.author.name) || '佚名').trim(),
    dynasty: ((d.dynasty && d.dynasty.name) || '').trim(),
  }
}

function readCache(day) {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY))
    if (raw && raw.day === day && Date.now() - raw.at < MAX_AGE) return raw.data
  } catch { /* ignore */ }
  return null
}
function writeCache(day, data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), day, data })) } catch { /* ignore */ }
}

const fallbackOf = (day) => POEMS_FALLBACK[hashOf(day + SALT) % POEMS_FALLBACK.length]

export async function fetchPoem(day = dayKey()) {
  const cached = readCache(day)
  if (cached) return { ...cached, source: 'cache' }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 9000)
  try {
    const res = await fetch(POEM_API, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`http ${res.status}`)
    const poem = toPoem(await res.json())
    if (!poem) return { ...fallbackOf(day), source: 'fallback' }
    writeCache(day, poem)
    return { ...poem, source: 'live' }
  } catch {
    return { ...fallbackOf(day), source: 'fallback' }
  } finally {
    clearTimeout(timer)
  }
}