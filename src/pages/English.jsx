import React, { useMemo, useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { Panel, Btn, Bar, Chip } from '../components/ui.jsx'
import { REWARDS, reward, sfx, emit } from '../lib/gamify.js'
import { gsap, D, useGSAP } from '../lib/anim.js'
import { useRef } from 'react'

const WORDS = [
  { w: 'persist', pos: 'v.', zh: '坚持；持续', ex: 'She persisted until the little garden bloomed.' },
  { w: 'cozy', pos: 'adj.', zh: '温暖舒适的', ex: 'The pixel cabin feels cozy on rainy days.' },
  { w: 'spare', pos: 'adj.', zh: '空闲的；备用的', ex: 'What do you do in your spare time?' },
  { w: 'achieve', pos: 'v.', zh: '实现；达到', ex: 'Small steps help you achieve big goals.' },
  { w: 'gentle', pos: 'adj.', zh: '温和的；轻柔的', ex: 'Be gentle with yourself today.' },
  { w: 'progress', pos: 'n.', zh: '进步', ex: 'Every drop of water is progress.' },
  { w: 'routine', pos: 'n.', zh: '惯例；日常', ex: 'A good routine keeps the town tidy.' },
  { w: 'grateful', pos: 'adj.', zh: '感激的', ex: 'I am grateful for tiny joys.' },
  { w: 'balance', pos: 'n.', zh: '平衡；余额', ex: 'Work and rest need balance.' },
  { w: 'curious', pos: 'adj.', zh: '好奇的', ex: 'Stay curious, like a cat in town.' },
  { w: 'harvest', pos: 'n.', zh: '收获', ex: 'Autumn is the harvest season.' },
  { w: 'refresh', pos: 'v.', zh: '刷新；恢复活力', ex: 'A short walk will refresh you.' },
  { w: 'gather', pos: 'v.', zh: '聚集；收集', ex: 'Villagers gather at the plaza.' },
  { w: 'sprout', pos: 'v.', zh: '发芽', ex: 'New ideas sprout every morning.' },
  { w: 'journey', pos: 'n.', zh: '旅程', ex: 'The journey matters more than the map.' },
  { w: 'tidy', pos: 'adj.', zh: '整洁的', ex: 'A tidy desk makes a tidy mind.' },
  { w: 'reward', pos: 'n.', zh: '奖励', ex: 'XP is a tiny reward for effort.' },
  { w: 'streak', pos: 'n.', zh: '连胜；连续记录', ex: 'A 7-day streak feels wonderful.' },
  { w: 'soothe', pos: 'v.', zh: '安抚；缓解', ex: 'Music soothes a tired heart.' },
  { w: 'bloom', pos: 'v.', zh: '开花', ex: 'Flowers bloom after patient care.' },
  { w: 'focus', pos: 'n.', zh: '专注', ex: 'Focus on one thing at a time.' },
  { w: 'hobby', pos: 'n.', zh: '爱好', ex: 'A hobby is a friend for life.' },
  { w: 'brief', pos: 'adj.', zh: '简短的', ex: 'Keep the meeting brief.' },
  { w: 'cheer', pos: 'v.', zh: '欢呼；加油', ex: 'The crowd cheers for tiny wins.' },
  { w: 'wander', pos: 'v.', zh: '漫步', ex: 'We wander along the pixel river.' },
  { w: 'plenty', pos: 'n.', zh: '充足；大量', ex: 'Drink plenty of water every day.' },
  { w: 'merry', pos: 'adj.', zh: '愉快的', ex: 'Merry little bells ring in town.' },
  { w: 'attempt', pos: 'n.', zh: '尝试', ex: 'Every attempt counts, even a fail.' },
]

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5)

export default function English() {
  const { state, dispatch } = useApp()
  const [mode, setMode] = useState('flash') // flash | quiz | book
  const [flipped, setFlipped] = useState(false)
  const [current, setCurrent] = useState(() => WORDS[0])
  const [quiz, setQuiz] = useState(null) // {word, options, picked}
  const cardRef = useRef(null)
  const eng = state.english

  useGSAP(() => {
    if (flipped && cardRef.current) {
      gsap.fromTo(cardRef.current, { rotationY: -90 }, { rotationY: 0, duration: D(0.3), ease: 'power2.out' })
    }
  }, { dependencies: [flipped], scope: cardRef })

  const pool = useMemo(() => WORDS.filter((x) => !eng.known.includes(x.w)), [eng.known])

  const nextFlash = () => {
    const p = pool.length ? pool : WORDS
    const next = p[Math.floor(Math.random() * p.length)]
    setCurrent(next === current && p.length > 1 ? p[(p.indexOf(next) + 1) % p.length] : next)
    setFlipped(false)
    sfx('pop')
  }

  const markKnown = (known) => {
    dispatch({ type: 'ENGLISH_KNOWN', word: current.w, known })
    if (known) {
      sfx('check')
      reward(dispatch, { xp: 4, coins: 1, msg: `掌握 ${current.w}`, icon: '🔤' })
    }
    nextFlash()
  }

  const newQuiz = () => {
    const p = pool.length >= 4 ? pool : WORDS
    const word = p[Math.floor(Math.random() * p.length)]
    const others = shuffle(WORDS.filter((x) => x.w !== word.w)).slice(0, 3)
    setQuiz({ word, options: shuffle([word, ...others]), picked: null })
    sfx('pop')
  }

  const pick = (opt) => {
    if (!quiz || quiz.picked) return
    const correct = opt.w === quiz.word.w
    setQuiz({ ...quiz, picked: opt.w })
    dispatch({ type: 'ENGLISH_RESULT', word: quiz.word.w, correct })
    if (correct) {
      sfx('coin')
      reward(dispatch, { ...REWARDS.english, msg: `答对 ${quiz.word.w}`, icon: '🎉' })
      setTimeout(newQuiz, 1100)
    } else {
      sfx('oops')
      emitToast(`正确答案是「${quiz.word.zh}」，已加入生词本`)
      setTimeout(newQuiz, 1600)
    }
  }

  const rate = eng.right + eng.wrong ? Math.round((eng.right / (eng.right + eng.wrong)) * 100) : 0

  return (
    <>
      <div className="seg lang-seg">
        <button className={mode === 'flash' ? 'on' : ''} onClick={() => { setMode('flash'); sfx('click') }}>🎴 闪卡</button>
        <button className={mode === 'quiz' ? 'on' : ''} onClick={() => { setMode('quiz'); if (!quiz) newQuiz(); sfx('click') }}>🎯 小测验</button>
        <button className={mode === 'book' ? 'on' : ''} onClick={() => { setMode('book'); sfx('click') }}>📖 生词本 ({eng.queue.length})</button>
      </div>

      {mode === 'flash' && (
        <Panel title="翻翻卡" icon="🎴" extra={<span className="xp-pill">已掌握 {eng.known.length} / {WORDS.length}</span>}>
          <Bar pct={(eng.known.length / WORDS.length) * 100} color="gold" />
          <div className="flashcard" ref={cardRef} onClick={() => setFlipped(!flipped)} title="点击翻开">
            {!flipped ? (
              <div className="flash-front">
                <span className="flash-word">{current.w}</span>
                <span className="flash-pos">{current.pos}</span>
                <span className="flash-hint">点击查看意思</span>
              </div>
            ) : (
              <div className="flash-back">
                <span className="flash-zh">{current.zh}</span>
                <span className="flash-ex">{current.ex}</span>
              </div>
            )}
          </div>
          <div className="btn-row center">
            <Btn color="red" onClick={() => markKnown(false)}>再看看 👀</Btn>
            <Btn color="green" onClick={() => markKnown(true)}>认识了 ✓ +4XP</Btn>
            <Btn onClick={nextFlash}>换一个 ↻</Btn>
          </div>
        </Panel>
      )}

      {mode === 'quiz' && (
        <Panel title="词义小测验" icon="🎯" extra={<span className="xp-pill">正确率 {rate}%（{eng.right}/{eng.right + eng.wrong}）</span>}>
          {!quiz ? (
            <div className="btn-row center"><Btn color="green" onClick={newQuiz}>开始测验 →</Btn></div>
          ) : (
            <div className="quiz">
              <div className="quiz-word">{quiz.word.w} <em>{quiz.word.pos}</em></div>
              <div className="quiz-options">
                {quiz.options.map((o) => {
                  const cls = !quiz.picked ? '' : o.w === quiz.word.w ? 'right' : o.w === quiz.picked ? 'wrong' : ''
                  return (
                    <button key={o.w} className={`quiz-opt ${cls}`} disabled={!!quiz.picked} onClick={() => pick(o)}>
                      {o.zh}
                    </button>
                  )
                })}
              </div>
              {quiz.picked && quiz.picked !== quiz.word.w && (
                <p className="quiz-ex">例句：{quiz.word.ex}</p>
              )}
            </div>
          )}
        </Panel>
      )}

      {mode === 'book' && (
        <Panel title="生词本" icon="📖" extra={<span className="xp-pill">{eng.queue.length} 个待复习</span>}>
          {eng.queue.length === 0 ? (
            <p className="empty">生词本空空的！做几道测验，答错的词会自动住进来。</p>
          ) : (
            <ul className="book-list">
              {eng.queue.map((w) => {
                const item = WORDS.find((x) => x.w === w)
                if (!item) return null
                return (
                  <li key={w} className="card book-item">
                    <b>{item.w}</b> <em>{item.pos}</em>
                    <span className="book-zh">{item.zh}</span>
                    <span className="book-ex">{item.ex}</span>
                    <Btn size="sm" color="green" onClick={() => { dispatch({ type: 'ENGLISH_KNOWN', word: w, known: true }); reward(dispatch, { xp: 2, msg: `复习 ${w}`, icon: '✨' }) }}>记住了</Btn>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>
      )}
    </>
  )
}

function emitToast(text) {
  emit('toast', { icon: '📝', text })
}
