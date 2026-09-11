// 每日诗词（今日题词）的单元测试
import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchPoem, POEMS_FALLBACK, POEM_API } from '../poem.js'
import { hashOf } from '../dates.js'

const LIVE = {
  data: {
    title: '春晓',
    content: ['春眠不觉晓，处处闻啼鸟。', '夜来风雨声，花落知多少。'],
    author: { name: '孟浩然' },
    dynasty: { name: '唐' },
  },
}

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear() })

describe('fetchPoem 每日诗词', () => {
  it('解析诗泉响应为统一结构（取前两行为主句）', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => LIVE })
    vi.stubGlobal('fetch', fetchMock)
    const p = await fetchPoem('2026-09-11')
    expect(p).toMatchObject({
      text: '春眠不觉晓，处处闻啼鸟。\n夜来风雨声，花落知多少。',
      title: '春晓',
      author: '孟浩然',
      dynasty: '唐',
      source: 'live',
    })
    expect(fetchMock).toHaveBeenCalledWith(POEM_API, expect.anything())
  })

  it('同一天二次调用不再请求网络（走每日缓存）', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => LIVE })
    vi.stubGlobal('fetch', fetchMock)
    const a = await fetchPoem('2026-09-12')
    const b = await fetchPoem('2026-09-12')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(b.source).toBe('cache')
    expect(b.text).toBe(a.text)
  })

  it('跨天重新拉取并换新', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => LIVE })
    vi.stubGlobal('fetch', fetchMock)
    await fetchPoem('2026-09-12')
    const b = await fetchPoem('2026-09-13')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(b.source).toBe('live')
  })

  it('接口挂掉时回退内置精选（同一天结果稳定）', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const a = await fetchPoem('2026-09-14')
    const b = await fetchPoem('2026-09-14')
    expect(a.source).toBe('fallback')
    expect(b.source).toBe('fallback')
    const expected = POEMS_FALLBACK[hashOf('2026-09-14:poem') % POEMS_FALLBACK.length]
    expect(a.text).toBe(expected.text)
    expect(a.title).toBe(expected.title)
  })

  it('HTTP 非 200 走兜底', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }))
    const p = await fetchPoem('2026-09-15')
    expect(p.source).toBe('fallback')
  })

  it('响应结构异常（无 content）也走兜底', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'error' }) }))
    const p = await fetchPoem('2026-09-15')
    expect(p.source).toBe('fallback')
  })

  it('内置兜底条目完整且足量', () => {
    expect(POEMS_FALLBACK.length).toBeGreaterThanOrEqual(10)
    for (const p of POEMS_FALLBACK) {
      expect(p.text).toBeTruthy()
      expect(p.title).toBeTruthy()
      expect(p.author).toBeTruthy()
      expect(p.dynasty).toBeTruthy()
    }
  })
})