/* 拾光小镇 Service Worker：整站只有一个自包含 index.html，缓存它即可完全离线。
   只注册于 http(s) 环境；双击 file:// 打开时不受影响（靠 vite-plugin-singlefile 兜底）。
   缓存名随版本递增（package.json version → vX-Y-Z，见项目记忆「版本规则」），改版后旧缓存自动清除。 */
const CACHE = 'pixel-town-v0-9-0'
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png',
  // 专注声音的真实录音（v0.9.0 起）：一并预缓存，装成 PWA 后断网也有声音
  './audio/rain.mp3', './audio/waves.mp3', './audio/fire.mp3', './audio/piano.mp3']

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const { request } = e
  if (request.method !== 'GET') return
  // 页面跳转：网络优先，断网回退缓存（保证「App 还在」）
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          // 更新缓存必须挂在 waitUntil 上：respondWith 返回后 SW 可能立刻被杀，put 会静默丢失
          e.waitUntil(caches.open(CACHE).then((c) => c.put('./index.html', copy)))
          return res
        })
        .catch(() => caches.match('./index.html'))
    )
    return
  }
  // 其余静态资源：stale-while-revalidate
  e.respondWith(
    caches.match(request).then((hit) => {
      const net = fetch(request)
        .then((res) => {
          const copy = res.clone()
          e.waitUntil(caches.open(CACHE).then((c) => c.put(request, copy)))
          return res
        })
        .catch(() => hit)
      return hit || net
    })
  )
})