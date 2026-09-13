import { useEffect, useState } from 'react'
import { pomoSubscribe } from '../lib/pomo.js'

// 专注氛围层（对标 ThreeUI 的 CRT 场景）：番茄钟专注轮进行中给全屏叠一层
// 像素扫描线 + 暗角，休息轮/暂停不显示；切页继续有效（番茄钟是模块级单例）。
// 视觉全部在 CSS（.focus-veil），这里只订阅番茄钟状态决定亮不亮。
export default function FocusAmbience() {
  const [on, setOn] = useState(false)
  useEffect(() => pomoSubscribe((p) => setOn(p.running && p.mode === 'focus')), [])
  return <div className="focus-veil" data-on={on ? '' : undefined} aria-hidden="true" />
}
