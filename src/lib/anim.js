import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(useGSAP)
gsap.defaults({ ease: 'power2.out', duration: 0.5 })

export const prefersReduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// 时长助手：用户偏好减少动效时把时长归零
export const D = (t) => (prefersReduced() ? 0 : t)

export { gsap, useGSAP }
