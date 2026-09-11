// ---------- localStorage + TTL 缓存工具 ----------
// news / weather / poem 三处此前各自实现了一套「写入带时间戳、读取先验新鲜度」的缓存，
// 统一到这里（见待优化 7），避免第四处复制。
// 存储结构：{ at: 写入时间戳, data: 业务数据 }；业务与数据结构用外部版本化 key 区分。

export function cacheWrite(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), data })) } catch { /* 隐私模式等场景静默 */ }
}

// valid(data) 返回 false 视为未命中（如 poem 需核对缓存所属的日期）
// 返回整个条目 { at, data }，调用方按需取 at（如 news 的 cachedAt）或 data
export function cacheRead(key, ttl, valid) {
  try {
    const c = JSON.parse(localStorage.getItem(key))
    if (!c || Date.now() - c.at >= ttl) return null
    if (valid && !valid(c.data)) return null
    return c
  } catch { return null }
}