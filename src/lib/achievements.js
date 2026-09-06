// ---------- 成就徽章（宽恕优先：只庆祝，绝不倒扣） ----------
// check(s) 必须是纯函数，只读 state；解锁判定在 App 层跑，解锁动作 dispatch ACH_UNLOCK。
export const ACHIEVEMENTS = [
  { id: 'first-todo', icon: '🌱', name: '初次冒险', desc: '完成第一件待办', coins: 5, check: (s) => (s.profile.stats?.todosDone || 0) >= 1 },
  { id: 'todos-100', icon: '💪', name: '百件小事', desc: '累计完成 100 件待办', coins: 20, check: (s) => (s.profile.stats?.todosDone || 0) >= 100 },
  { id: 'streak-7', icon: '🔥', name: '七日之约', desc: '连续投入 7 天', coins: 10, check: (s) => s.profile.streak >= 7 },
  { id: 'streak-30', icon: '🌟', name: '三十而立', desc: '连续投入 30 天', coins: 30, check: (s) => s.profile.streak >= 30 },
  { id: 'ledger-first', icon: '🧾', name: '第一笔账', desc: '记下第一笔收支', coins: 5, check: (s) => (s.profile.stats?.ledger || 0) >= 1 },
  { id: 'ledger-100', icon: '💰', name: '百笔流水', desc: '累计记账 100 笔', coins: 20, check: (s) => (s.profile.stats?.ledger || 0) >= 100 },
  { id: 'review-first', icon: '🌙', name: '第一篇复盘', desc: '写下第一篇晚间复盘', coins: 5, check: (s) => Object.keys(s.reviews || {}).length >= 1 },
  { id: 'review-30', icon: '📔', name: '三十夜话', desc: '累计 30 篇复盘', coins: 20, check: (s) => Object.keys(s.reviews || {}).length >= 30 },
  { id: 'bloom-first', icon: '🌻', name: '初次绽放', desc: '第一次有植物盛开', coins: 10, check: (s) => (s.profile.collection || []).length >= 1 },
  { id: 'collector', icon: '🏆', name: '满园春色', desc: '集齐图鉴里全部植物', coins: 50, check: (s, total) => (s.profile.collection || []).length >= total && total > 0 },
  { id: 'words-50', icon: '🔤', name: '五十词', desc: '答对 50 道单词题', coins: 10, check: (s) => (s.english?.right || 0) >= 50 },
  { id: 'level-10', icon: '🗼', name: '十级镇民', desc: '升到 Lv.10', coins: 25, check: (s) => s.profile.level >= 10 },
  { id: 'water-100', icon: '💧', name: '百次浇灌', desc: '花园被浇灌 100 次', coins: 15, check: (s) => (s.profile.waterTotal || 0) >= 100 },
  { id: 'pomo-10', icon: '⏰', name: '十个番茄', desc: '完成 10 个番茄钟', coins: 15, check: (s) => (s.profile.stats?.pomos || 0) >= 10 },
]
