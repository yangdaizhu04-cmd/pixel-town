// 页面/组件 smoke 测试：每个页面在 AppProvider 里真实挂载一遍，断言「不崩溃且渲染出内容」。
// 这是重构（拆 Context / 抽 hooks / 拆 Museum）前的安全网——纯函数单测盖不住 JSX 层的接线错误。
import { describe, it, expect } from 'vitest'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { AppProvider } from '../lib/store.jsx'
import App from '../App.jsx'
import Dashboard from '../pages/Dashboard.jsx'
import Todos from '../pages/Todos.jsx'
import Ledger from '../pages/Ledger.jsx'
import Habits from '../pages/Habits.jsx'
import News from '../pages/News.jsx'
import Study from '../pages/Study.jsx'
import English from '../pages/English.jsx'
import Weight from '../pages/Weight.jsx'
import Review from '../pages/Review.jsx'
import Museum from '../pages/Museum.jsx'
import AgentChat, { BirdAvatar } from '../components/AgentChat.jsx'
import SettingsModal from '../components/SettingsModal.jsx'
import ShopModal from '../components/ShopModal.jsx'
import IntroOverlay from '../components/IntroOverlay.jsx'
import AguVisit from '../components/AguVisit.jsx'
import { ToastHost, ConfettiHost, LevelUpModal } from '../components/effects.jsx'
import { ConfirmHost } from '../components/ui.jsx'

async function mount(ui) {
  const div = document.createElement('div')
  document.body.appendChild(div)
  let root
  await act(async () => {
    root = createRoot(div)
    root.render(<AppProvider>{ui}</AppProvider>)
  })
  // 再冲刷一轮微任务：让挂载 effect 里的 fetch 兜底/setState 落地（离线 stub 会走 catch 分支）
  await act(async () => {})
  return {
    html: div.innerHTML,
    unmount: async () => {
      await act(async () => root.unmount())
      div.remove()
    },
  }
}

const PAGES = [
  ['Dashboard', () => <Dashboard />],
  ['Todos', () => <Todos />],
  ['Ledger', () => <Ledger />],
  ['Habits', () => <Habits />],
  ['News', () => <News />],
  ['Study', () => <Study />],
  ['English', () => <English />],
  ['Weight', () => <Weight />],
  ['Review', () => <Review />],
  ['Museum', () => <Museum />],
  ['AgentChat', () => <AgentChat onOpenSettings={() => {}} />],
]

describe('页面 smoke：挂载不崩溃', () => {
  it.each(PAGES)('%s 渲染出内容', async (_name, make) => {
    const m = await mount(make())
    expect(m.html.length).toBeGreaterThan(0)
    await m.unmount()
  })
})

describe('全局组件 smoke', () => {
  it.each([
    ['App 整体', () => <App />, true],
    ['ToastHost/ConfettiHost/ConfirmHost/LevelUpModal', () => <><ToastHost /><ConfettiHost /><ConfirmHost /><LevelUpModal level={null} /></>, true],
    ['SettingsModal（关闭态：Modal 返回 null，不崩即可）', () => <SettingsModal open={false} onClose={() => {}} />, false],
    ['ShopModal（关闭态：Modal 返回 null，不崩即可）', () => <ShopModal open={false} onClose={() => {}} />, false],
    ['IntroOverlay', () => <IntroOverlay onDone={() => {}} />, true],
    ['AguVisit + BirdAvatar', () => <><AguVisit onGoChat={() => {}} /><BirdAvatar /></>, true],
  ])('%s', async (_name, make, expectContent) => {
    const m = await mount(make())
    if (expectContent) expect(m.html.length).toBeGreaterThan(0)
    else expect(m.html).toBe('')
    await m.unmount()
  })
})
