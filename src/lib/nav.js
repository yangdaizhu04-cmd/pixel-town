// ---------- 页面注册表：导航、快捷键、标题、移动端 Tab 的单一来源 ----------
// 抽出来是为了让 hooks（如 usePageTitle）和 App 都能引用，避免 hooks → App 的循环依赖。
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
import AgentChat from '../components/AgentChat.jsx'

export const PAGES = [
  { id: 'home', icon: '🏠', label: '首页总览', comp: Dashboard },
  { id: 'todos', icon: '📝', label: '待办清单', comp: Todos },
  { id: 'ledger', icon: '💰', label: '收支账本', comp: Ledger },
  { id: 'habits', icon: '✅', label: '习惯打卡', comp: Habits },
  { id: 'news', icon: '📰', label: '每日 AI 新闻', comp: News },
  { id: 'study', icon: '📚', label: '学习计划', comp: Study },
  { id: 'english', icon: '🔤', label: '英语练习', comp: English },
  { id: 'weight', icon: '⚖️', label: '体重记录', comp: Weight },
  { id: 'review', icon: '🌙', label: '每日复盘', comp: Review },
  { id: 'museum', icon: '🏛️', label: '小镇年鉴', comp: Museum },
  { id: 'agent', icon: '🐣', label: '小镇精灵', comp: AgentChat },
]
export const HOTKEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-']
// 移动端底部 Tab 用的短标签
export const SHORT = { home: '首页', todos: '待办', ledger: '账本', habits: '习惯', news: '新闻', study: '学习', english: '英语', weight: '体重', review: '复盘', museum: '年鉴', agent: '阿咕' }

export const TIPS = [
  '完成任务会自动给花园浇水，每天第一次手动浇水免费。',
  '今日 XP 达到 25 / 50 / 80 / 120 时，记得开冒险礼箱！',
  '写一篇复盘 +15 XP，还能点亮心情月历。',
  '答错的单词会自动住进生词本，按遗忘曲线催你复习。',
  '盛开的植物可以「采集种子」换金币，再去商店买新花盆！',
  '番茄钟挂在「学习计划」页，切页也会继续走。',
  '数字键 1-9、0、- 可以快速切页。',
  '月底记得去账本看看「钱都去哪了」，还能设预算。',
  '把明天的第一件事写小一点，小到不可能失败。',
]
