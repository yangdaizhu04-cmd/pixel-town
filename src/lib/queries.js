// ---------- 数据查询口径：dataSummary（注入大模型）与 localAgent（离线小精灵）共用 ----------
// 以前两边各写一份「习惯完成几个 / 学习进度几小时」，改口径容易只改一边。
import { dayKey } from './dates.js'
import { monthInOut, balanceOf, lastWeight, bmiOf, studyDone } from './store.jsx'

// 今日已完成 / 未完成的习惯
export const habitsDoneToday = (s) => s.habits.filter((h) => h.days[dayKey()])
export const habitsLeftToday = (s) => s.habits.filter((h) => !h.days[dayKey()])

// 本月收支 + 总结余，一次算齐
export const monthMoney = (s) => {
  const { i, o } = monthInOut(s)
  return { i, o, bal: balanceOf(s) }
}

// 学习进度（小时，保留 1 位小数）
export const studyHours = (p) => Math.round(studyDone(p) / 60 * 10) / 10

// 最新体重 + BMI（没有体重时都为 null）
export const weightStatus = (s) => {
  const w = lastWeight(s)
  const bmi = bmiOf(s)
  return { w, bmi }
}
