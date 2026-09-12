// ---------- 专注声音面板（WebAudio 全实时合成，无音频文件） ----------
// 思路与手绘像素画同款：零素材，所有声音现场合成。四路音源（雨声/白噪/篝火/生成式钢琴）
// 各挂独立增益 → 主增益输出，可多路混音。偏好存 localStorage（设备本地属性，不入存档、不参与同步，
// 免得音量这类「桌面开大声、手机开小声」的偏好被同步覆盖）。
// 注意：AudioContext 必须在用户手势里创建/恢复（浏览器自动播放策略），所以所有开关都由点击触发。

const PREFS_KEY = 'pixel-town-sound'
export const SOUND_IDS = ['rain', 'white', 'fire', 'piano']
const DEFAULTS = {
  active: { rain: false, white: false, fire: false, piano: false },
  vol: { rain: 0.5, white: 0.35, fire: 0.5, piano: 0.5, master: 0.85 },
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

// ---------- 音频底座 ----------
let ctx = null
let master = null
function ac() {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  if (!ctx) {
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = prefs.vol.master
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function noiseBuffer(brown = false) {
  const c = ac()
  const len = c.sampleRate * 2
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  if (!brown) { for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1 } else {
    // 布朗噪：累积随机游走，低频更多，天然像「轰轰」的环境声
    let last = 0
    for (let i = 0; i < len; i++) {
      last = (last + (Math.random() * 2 - 1) * 0.02) * 0.998
      d[i] = last * 3.5
    }
  }
  return buf
}

// ---------- 四路音源：start 返回停止函数 ----------
const SOURCES = {
  white: {
    label: '白噪',
    start(out) {
      const c = ac()
      const src = c.createBufferSource()
      src.buffer = noiseBuffer(false)
      src.loop = true
      // 轻轻低通一下，去掉最刺的「嘶嘶」高频
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 6000
      src.connect(lp).connect(out)
      src.start()
      return () => { try { src.stop() } catch { /* ignore */ } }
    },
  },
  rain: {
    label: '雨声',
    start(out) {
      const c = ac()
      const src = c.createBufferSource()
      src.buffer = noiseBuffer(false)
      src.loop = true
      // 雨声配方：白噪 + 带通（保留 400~1600Hz 的「沙沙」带）+ 慢速 LFO 让雨势有起伏
      const hp = c.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 400
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 1600
      const swell = c.createGain()
      swell.gain.value = 0.7
      const lfo = c.createOscillator()
      lfo.frequency.value = 0.09
      const lfoGain = c.createGain()
      lfoGain.gain.value = 0.25
      lfo.connect(lfoGain).connect(swell.gain)
      src.connect(hp).connect(lp).connect(swell).connect(out)
      src.start()
      lfo.start()
      return () => { try { src.stop(); lfo.stop() } catch { /* ignore */ } }
    },
  },
  fire: {
    label: '篝火',
    start(out) {
      const c = ac()
      const src = c.createBufferSource()
      src.buffer = noiseBuffer(true)
      src.loop = true
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 480
      src.connect(lp).connect(out)
      src.start()
      // 噼啪：随机间隔的高频短爆（带通 2.5kHz + 指数衰减包络）
      const timer = setInterval(() => {
        if (Math.random() > 0.75) return
        const t0 = ctx.currentTime
        const burst = ctx.createBufferSource()
        burst.buffer = noiseBuffer(false)
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = 2200 + Math.random() * 1600
        bp.Q.value = 6
        const g = ctx.createGain()
        const dur = 0.03 + Math.random() * 0.06
        g.gain.setValueAtTime(0.5 + Math.random() * 0.5, t0)
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
        burst.connect(bp).connect(g).connect(out)
        burst.start(t0)
        burst.stop(t0 + dur + 0.02)
      }, 90)
      return () => { clearInterval(timer); try { src.stop() } catch { /* ignore */ } }
    },
  },
  piano: {
    label: '钢琴',
    start(out) {
      const c = ac()
      // 五声音阶（C 宫）：怎么随机弹都不难听
      const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25]
      // 反馈延迟当简易混响：0.38s 一拍，衰减 0.35
      const delay = c.createDelay(1)
      delay.delayTime.value = 0.38
      const fb = c.createGain()
      fb.gain.value = 0.35
      const wet = c.createGain()
      wet.gain.value = 0.35
      delay.connect(fb).connect(delay)
      delay.connect(wet).connect(out)
      const play = (freq, when, vol) => {
        const t0 = when ?? ctx.currentTime
        const env = ctx.createGain()
        env.gain.setValueAtTime(0, t0)
        env.gain.linearRampToValueAtTime(vol, t0 + 0.02)
        env.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.6)
        const o1 = ctx.createOscillator()
        o1.type = 'sine'
        o1.frequency.value = freq
        const o2 = ctx.createOscillator()
        o2.type = 'triangle'
        o2.frequency.value = freq * 2.001 // 高八度泛音多一点「木质感」
        const g2 = ctx.createGain()
        g2.gain.value = 0.18
        o1.connect(env); o2.connect(g2).connect(env)
        env.connect(out); env.connect(delay)
        o1.start(t0); o2.start(t0)
        o1.stop(t0 + 2.8); o2.stop(t0 + 2.8)
      }
      const timer = setInterval(() => {
        const f = SCALE[Math.floor(Math.random() * SCALE.length)]
        play(f, null, 0.16 + Math.random() * 0.1)
        if (Math.random() < 0.22) play(SCALE[Math.floor(Math.random() * SCALE.length)], ctx.currentTime + 0.24, 0.1) // 偶尔带个双音
      }, 1500)
      // 进门先弹一个音，让用户立刻听到「开了」
      play(SCALE[2], ctx.currentTime + 0.05, 0.2)
      return () => { clearInterval(timer); try { delay.disconnect(); wet.disconnect(); fb.disconnect() } catch { /* ignore */ } }
    },
  },
}

// ---------- 运行时开关 ----------
const running = new Map() // id -> stop()

function startSource(id) {
  if (running.has(id) || !SOURCES[id]) return
  const c = ac()
  if (!c) return
  const gain = c.createGain()
  gain.gain.value = prefs.vol[id]
  gain.connect(master)
  running.set(id, { gain, stop: SOURCES[id].start(gain) })
}
function stopSource(id) {
  const n = running.get(id)
  if (!n) return
  try { n.stop() } catch { /* ignore */ }
  try { n.gain.disconnect() } catch { /* ignore */ }
  running.delete(id)
}

export function soundToggle(id) {
  if (!SOURCES[id]) return
  if (running.has(id)) stopSource(id)
  else startSource(id)
  prefs.active[id] = running.has(id)
  save()
  notify()
}
export function soundVol(id, v) {
  prefs.vol[id] = Math.min(1, Math.max(0, v))
  if (running.has(id)) running.get(id).gain.gain.value = prefs.vol[id]
  save()
  notify()
}
export function soundMaster(v) {
  prefs.vol.master = Math.min(1, Math.max(0, v))
  if (master) master.gain.value = prefs.vol.master
  save()
  notify()
}
export const soundLabel = (id) => SOURCES[id]?.label || id
export const soundIsLive = (id) => running.has(id)

// 番茄钟开始专注时恢复上次的组合（调用方处于点击手势里，符合自动播放策略）
export function soundAutoStart() {
  if (!prefs.autoFocus) return
  for (const id of SOUND_IDS) if (prefs.active[id]) startSource(id)
  notify()
}
export function soundStopAll() {
  for (const id of [...running.keys()]) stopSource(id)
  prefs.active = { rain: false, white: false, fire: false, piano: false }
  save()
  notify()
}
export function soundSetAutoFocus(v) {
  prefs.autoFocus = !!v
  save()
  notify()
}
