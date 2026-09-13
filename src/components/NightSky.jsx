import { useEffect, useRef, useState } from 'react'
import { makeStars, spawnMeteor, stepMeteor, drawNightSky, rng } from '../lib/nightsky.js'
import { prefersReduced } from '../lib/anim.js'

// 夜空氛围层：只在夜间时段（body[data-period='night']）渲染进 App 的 .sky 层。
// 星星布局/动画逻辑都在 lib/nightsky.js（纯函数，有单测）；这里只负责：
// 观察时段切换、管理 canvas 尺寸与 rAF 生命周期、reduced-motion 时画一帧静态星图。
export default function NightSky() {
  const [night, setNight] = useState(() => document.body?.dataset.period === 'night')
  const canvasRef = useRef(null)

  // 昼夜时段由 hooks.js 每 60s 写 body[data-period]，这里监听变化即插即用
  useEffect(() => {
    const sync = () => setNight(document.body.dataset.period === 'night')
    sync()
    const obs = new MutationObserver(sync)
    obs.observe(document.body, { attributes: true, attributeFilter: ['data-period'] })
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!night) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const reduced = prefersReduced()
    let raf = 0
    let stars = []
    let meteors = []
    let nextMeteorAt = 0

    const drawStatic = () => {
      drawNightSky(ctx, { w: canvas.clientWidth, h: canvas.clientHeight, stars, meteors: [], t: 0 })
    }
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = canvas.clientWidth * dpr
      canvas.height = canvas.clientHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      stars = makeStars(canvas.clientWidth, canvas.clientHeight, 64, rng(20260913))
      if (reduced) drawStatic()
    }

    const frame = (now) => {
      // 流星调度：约 18~36s 一颗，克制到"偶发"而不是烟花
      if (now >= nextMeteorAt) {
        meteors.push(spawnMeteor(canvas.clientWidth, canvas.clientHeight))
        nextMeteorAt = now + 18000 + Math.random() * 18000
      }
      meteors = meteors.map((m) => stepMeteor(m, canvas.clientWidth, canvas.clientHeight)).filter(Boolean)
      drawNightSky(ctx, { w: canvas.clientWidth, h: canvas.clientHeight, stars, meteors, t: now / 1000 })
      raf = requestAnimationFrame(frame)
    }

    resize()
    window.addEventListener('resize', resize)

    if (reduced) {
      // 减少动效：只画一帧静态星星，不闪烁不流星
      drawStatic()
    } else {
      nextMeteorAt = performance.now() + 8000
      raf = requestAnimationFrame(frame)
    }

    // 标签页隐藏时显式停掉 rAF（比等浏览器节流更省电）
    const onVis = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf)
        raf = 0
      } else if (!raf && !prefersReduced()) {
        raf = requestAnimationFrame(frame)
      }
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [night])

  if (!night) return null
  return <canvas ref={canvasRef} className="nightsky" aria-hidden="true" />
}
