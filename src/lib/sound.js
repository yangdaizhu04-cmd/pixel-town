// ---------- 专注声音面板（真实录音循环，HTMLAudio 播放） ----------
// v0.9.0：应用户要求把 WebAudio 合成音全部换成真实录音。来源 Pixabay（Content License：
// 免费商用、免署名，具体曲目与 URL 见项目交接文档第二十一节），文件放 public/audio/*.mp3
// ——public 资源构建时原样拷贝、不被 singlefile 内联，<audio> 相对路径在 http(s) 与
// file:// 双击场景都能直接播。
// 四路音源（雨声/海浪/篝火/钢琴）各挂独立音量 × 主音量，可多路混音。
// 偏好存 localStorage（设备本地属性，不入存档、不参与同步，免得音量这类
// 「桌面开大声、手机开小声」的偏好被同步覆盖）。
// 注意：play() 必须在用户手势里调用（浏览器自动播放策略），所有开关都由点击触发；
// 8-bit 界面音效（gamify.js）仍是 WebAudio 合成——那是像素风的刻意设计，与录音不冲突。

const PREFS_KEY = 'pixel-town-sound'
export const SOUND_IDS = ['rain', 'waves', 'fire', 'piano']
const FILES = {
  rain: 'audio/rain.mp3',
  waves: 'audio/waves.mp3',
  fire: 'audio/fire.mp3',
  piano: 'audio/piano.mp3',
}
const LABELS = { rain: '雨声', waves: '海浪', fire: '篝火', piano: '钢琴' }
const DEFAULTS = {
  active: { rain: false, waves: false, fire: false, piano: false },
  vol: { rain: 0.5, waves: 0.45, fire: 0.5, piano: 0.5, master: 0.85 },
  autoFocus: false, // 番茄钟开始专注时自动打开上次的声音组合
}

function loadPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')
    return {
      ...DEFAULTS,
      ...raw,
      active: { ...DEFAULTS.active, ...(raw.active || {}) },
      vol: { ...DEFAULTS.vol, ...(raw.vol || {}) },
    }
  } catch { return { ...DEFAULTS, active: { ...DEFAULTS.active }, vol: { ...DEFAULTS.vol } } }
}

let prefs = loadPrefs()
const subs = new Set()
const notify = () => { const p = soundPrefs(); subs.forEach((f) => { try { f(p) } catch { /* ignore */ } }) }
export const soundPrefs = () => JSON.parse(JSON.stringify(prefs))
export const soundSubscribe = (f) => { subs.add(f); return () => subs.delete(f) }
function save() {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)) } catch { /* ignore */ }
}

// ---------- 音频底座：每个音源一个循环 <audio>，音量 = 路音量 × 主音量 ----------
const els = new Map() // id -> HTMLAudioElement
const running = new Map() // id -> HTMLAudioElement（意图上的激活集合，start 即登记）

function elOf(id) {
  let n = els.get(id)
  if (!n) {
    n = new Audio(FILES[id])
    n.loop = true
    n.preload = 'none' // 点了才拉文件，首屏不吃这几 MB
    els.set(id, n)
  }
  return n
}

function applyVol(id) {
  const n = running.get(id)
  if (n) n.volume = Math.min(1, Math.max(0, prefs.vol[id] * prefs.vol.master))
}

function startSource(id) {
  if (running.has(id) || !FILES[id]) return
  const n = elOf(id)
  running.set(id, n)
  applyVol(id)
  n.play().catch(() => {
    // 播放失败（文件缺失/自动播放策略拦截）：回滚激活态，UI 与实际一致
    if (running.get(id) === n) {
      n.pause()
      running.delete(id)
      prefs.active[id] = false
      save()
      notify()
    }
  })
}
function stopSource(id) {
  const n = running.get(id)
  if (!n) return
  n.pause()
  running.delete(id)
}

// ---------- 运行时开关（对外 API 与合成音版本保持一致，调用方零改动） ----------
export function soundToggle(id) {
  if (!FILES[id]) return
  if (running.has(id)) stopSource(id)
  else startSource(id)
  prefs.active[id] = running.has(id)
  save()
  notify()
}
export function soundVol(id, v) {
  prefs.vol[id] = Math.min(1, Math.max(0, v))
  applyVol(id)
  save()
  notify()
}
export function soundMaster(v) {
  prefs.vol.master = Math.min(1, Math.max(0, v))
  for (const id of SOUND_IDS) applyVol(id)
  save()
  notify()
}
export const soundLabel = (id) => LABELS[id] || id
export const soundIsLive = (id) => running.has(id)

// 番茄钟开始专注时恢复上次的组合（调用方处于点击手势里，符合自动播放策略）
export function soundAutoStart() {
  if (!prefs.autoFocus) return
  for (const id of SOUND_IDS) if (prefs.active[id]) startSource(id)
  notify()
}
export function soundStopAll() {
  for (const id of [...running.keys()]) stopSource(id)
  prefs.active = { rain: false, waves: false, fire: false, piano: false }
  save()
  notify()
}
export function soundSetAutoFocus(v) {
  prefs.autoFocus = !!v
  save()
  notify()
}
