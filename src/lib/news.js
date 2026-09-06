// 每日 AI 新闻：rss2json 在线抓取 + 内置精选兜底，本地缓存 6 小时
const CACHE_KEY = 'pixel-town-news-v1'
const MAX_AGE = 6 * 3600 * 1000

export const NEWS_FALLBACK = [
  { title: '端侧小模型持续提速，手机上的 AI 助手越来越聪明', source: '内置精选', url: '', date: '', summary: '量化和蒸馏技术让 3B 级模型流畅跑进主流手机，离线语音助手、相册搜索正在变成标配。' },
  { title: 'Agent 记忆机制成为研究热点：让 AI 真正记住你', source: '内置精选', url: '', date: '', summary: '长期记忆、检索增强与个性化偏好建模，被视作智能体从「能聊」走向「好用」的关键一步。' },
  { title: '开源社区涌现多款轻量模型，本地部署门槛继续降低', source: '内置精选', url: '', date: '', summary: '一行命令在笔记本上跑起对话模型不再是极客专属，工具链的成熟让普通人也能玩转本地 AI。' },
  { title: '多模态能力进入办公软件，图表理解与文档问答更普及', source: '内置精选', url: '', date: '', summary: '把表格丢给 AI 直接提问、让助手读懂设计稿——多模态正在悄悄改变日常办公流。' },
  { title: 'AI 硬件新品类升温：随身设备想成为你的「第二大脑」', source: '内置精选', url: '', date: '', summary: '录音吊坠、口袋伴侣……硬件厂商尝试用「随时在场」的智能体，接住生活中一闪而过的念头。' },
  { title: '代码助手走向「任务级」：从补全一行到自动完成小需求', source: '内置精选', url: '', date: '', summary: '智能体编程工具开始接管完整的小任务：改 bug、写测试、跑通构建，程序员变成审稿人。' },
  { title: 'AI 生成内容标识规范逐步落地，平台开始标注来源', source: '内置精选', url: '', date: '', summary: '给 AI 内容「盖上印章」正成为行业共识，透明度被视为建立信任的第一步。' },
  { title: '研究者关注「AI 疲劳」：效率工具也需要被温柔使用', source: '内置精选', url: '', date: '', summary: '不停被工具催促反而更累？研究建议把 AI 当成伙伴而不是监工，留出发呆和慢慢想的时间。' },
]

const SOURCES = [
  { name: '量子位', url: 'https://www.qbitai.com/feed' },
  { name: '爱范儿', url: 'https://www.ifanr.com/feed', filter: /AI|大模型|智能|Agent|OpenAI|机器人/i },
  { name: 'InfoQ', url: 'https://www.infoq.cn/feed', filter: /AI|大模型|智能|Agent|OpenAI|机器人/i },
  { name: 'Hacker News', url: 'https://hnrss.org/frontpage', filter: /AI|LLM|GPT|Agent|OpenAI|Anthropic|Claude|Gemini|robot/i },
]

const stripHtml = (h) =>
  (h || '').replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim()

const cleanSummary = (h) => {
  let s = stripHtml(h)
  // Hacker News 的描述是「Article URL: … Comments URL: … Points: …」格式，清理成正文
  s = s.replace(/^Article URL:\s*\S+\s*Comments URL:\s*\S+\s*/, '')
       .replace(/^Points:\s*\d+\s*/, '')
       .replace(/^#\s*Comments:.*$/, '')
       .replace(/#\s*\d+\s*Comments:.*$/, '')
  return s.trim()
}

async function fetchOne(src, signal) {
  const api = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(src.url)}`
  const res = await fetch(api, { signal })
  if (!res.ok) throw new Error(`http ${res.status}`)
  const data = await res.json()
  if (data.status !== 'ok') throw new Error('feed error')
  return (data.items || [])
    .filter((it) => !src.filter || src.filter.test(it.title || ''))
    .map((it) => ({
      title: it.title || '',
      source: src.name,
      url: it.link || '',
      summary: cleanSummary(it.description || it.content || '').slice(0, 120),
      date: (it.pubDate || '').slice(0, 10),
    }))
}

export function readNewsCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY))
    if (c && Date.now() - c.at < MAX_AGE && c.items && c.items.length) return c
  } catch { /* ignore */ }
  return null
}

export async function fetchNews(force = false) {
  if (!force) {
    const c = readNewsCache()
    if (c) return { items: c.items, cachedAt: c.at, source: 'cache' }
  }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 9000)
  try {
    const results = await Promise.allSettled(SOURCES.map((s) => fetchOne(s, ctrl.signal)))
    clearTimeout(timer)
    const items = []
    const seen = new Set()
    for (const r of results) {
      if (r.status !== 'fulfilled') continue
      for (const it of r.value) {
        const k = (it.title || '').slice(0, 18)
        if (!k || seen.has(k)) continue
        seen.add(k)
        items.push(it)
      }
    }
    if (!items.length) return { items: NEWS_FALLBACK, cachedAt: Date.now(), source: 'fallback' }
    items.sort((a, b) => (a.date < b.date ? 1 : -1))
    const picked = items.slice(0, 20)
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), items: picked })) } catch { /* ignore */ }
    return { items: picked, cachedAt: Date.now(), source: 'live' }
  } catch {
    clearTimeout(timer)
    return { items: NEWS_FALLBACK, cachedAt: Date.now(), source: 'fallback' }
  }
}
