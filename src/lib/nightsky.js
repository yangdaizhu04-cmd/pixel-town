// ---------- 夜空氛围（纯逻辑，供 components/NightSky.jsx 调用与单测） ----------
// 参考 ThreeUI 的深色场景层次感（Constellation Field 一类），按项目约束做像素化转译：
// 星星是贴 2px 网格的方块、无抗锯齿；闪烁用正弦相位错峰；流星低频出现。
// 不引入 three.js：单文件体积红线内用 canvas 2D 达到同类的"活"感。

// mulberry32 确定性伪随机：同一 seed 的星星布局一致，窗口 resize 重绘不跳变
export function rng(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const TONES = ['#ffffff', '#ffeec9', '#cfe4ff']

// 生成星星：y 控制在画布上部 75%（下面留给山丘），坐标吸附 2px 网格保持像素感
export function makeStars(w, h, count = 64, rand = Math.random) {
  const maxY = Math.max(0, Math.floor((h * 0.75) / 2))
  return Array.from({ length: Math.max(0, Math.floor(count)) }, () => ({
    x: Math.floor((rand() * w) / 2) * 2,
    y: Math.floor((rand() * maxY) / 2) * 2,
    s: rand() < 0.78 ? 2 : 4,
    phase: rand() * Math.PI * 2,
    speed: 0.4 + rand() * 0.9, // 每颗闪烁快慢不同
    tone: TONES[Math.floor(rand() * TONES.length)],
  }))
}

// 流星从上方区域斜向右下；life 是帧数上限（防呆，正常会先飞出画布）
export function spawnMeteor(w, h, rand = Math.random) {
  const speed = 4 + rand() * 2
  return {
    x: rand() * w * 0.7,
    y: rand() * h * 0.25,
    vx: speed,
    vy: speed * 0.55,
    life: 90,
  }
}

// 步进一颗流星；飞出画布或耗尽寿命返回 null（调用方 filter 掉）
export function stepMeteor(m, w, h) {
  const next = { ...m, x: m.x + m.vx, y: m.y + m.vy, life: m.life - 1 }
  if (next.life <= 0 || next.x > w + 40 || next.y > h * 0.8) return null
  return next
}

// 画一帧：星星按各自相位闪烁；流星画 6 格渐隐尾巴
export function drawNightSky(ctx, { w, h, stars, meteors, t }) {
  ctx.clearRect(0, 0, w, h)
  for (const s of stars) {
    ctx.globalAlpha = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase))
    ctx.fillStyle = s.tone
    ctx.fillRect(s.x, s.y, s.s, s.s)
  }
  ctx.fillStyle = '#fff7d6'
  for (const m of meteors) {
    for (let i = 0; i < 6; i++) {
      ctx.globalAlpha = (1 - i / 6) * 0.9
      const tx = Math.round((m.x - m.vx * i * 1.6) / 2) * 2
      const ty = Math.round((m.y - m.vy * i * 1.6) / 2) * 2
      ctx.fillRect(tx, ty, 2, 2)
    }
  }
  ctx.globalAlpha = 1
}
