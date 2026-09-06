import React, { useMemo, useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { Panel, Btn, Bar, Chip } from '../components/ui.jsx'
import { REWARDS, reward, sfx, emit } from '../lib/gamify.js'
import { gsap, D, useGSAP } from '../lib/anim.js'
import { speak } from '../lib/tts.js'
import { WORDS } from '../lib/words.js'
import { useRef } from 'react'
import { dayKey, daysBetween } from '../lib/dates.js'

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5)
// 词单行格式：单词[,词性][,中文][,例句]（逗号/中文逗号/Tab 均可）
const parseWordLine = (line) => {
  const parts = line.split(/[,，\t]/).map((x) => x.trim()).filter(Boolean)
  if (parts.length < 2) return null
  const [w, pos, zh, ex] = parts
  if (!/^[a-zA-Z][a-zA-Z' -]*$/.test(w)) return null
  // 只有两列时，第二列视为中文释义
  const zhText = parts.length === 2 ? pos : zh || pos
  return { w: w.toLowerCase(), pos: parts.length === 2 ? '' : (pos || ''), zh: zhText, ex: ex || '' }
}

export default function English() {
  const { state, dispatch } = useApp()
  const [mode, setMode] = useState('flash') // flash | quiz | book | import
  const [flipped, setFlipped] = useState(false)
  const [current, setCurrent] = useState(() => WORDS[0])
  const [quiz, setQuiz] = useState(null) // {word, options, picked, review}
  const [importText, setImportText] = useState('')
  const cardRef = useRef(null)
  const eng = state.english
  const custom = useMemo(() => state.english.custom || [], [state.english.custom])
  const t = dayKey()

  useGSAP(() => {
    if (flipped && cardRef.current) {
      gsap.fromTo(cardRef.current, { rotationY: -90 }, { rotationY: 0, duration: D(0.3), ease: 'power2.out' })
    }
  }, { dependencies: [flipped], scope: cardRef })

  const allWords = useMemo(() => [...WORDS, ...custom], [custom])
  const pool = useMemo(() => allWords.filter((x) => !eng.known.includes(x.w)), [allWords, eng.known])
  const dueWords = useMemo(
    () => (eng.queue || []).filter((q) => q.due <= t).map((q) => allWords.find((x) => x.w === q.w)).filter(Boolean),
    [eng.queue, allWords, t],
  )

  const nextFlash = () => {
    const p = pool.length ? pool : allWords
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
    // 有到期的生词就优先复习（简化版间隔重复调度）
    if (dueWords.length) {
      const word = dueWords[Math.floor(Math.random() * dueWords.length)]
      const others = shuffle(allWords.filter((x) => x.w !== word.w)).slice(0, 3)
      setQuiz({ word, options: shuffle([word, ...others]), picked: null, review: true })
      sfx('pop')
      return
    }
    const p = pool.length >= 4 ? pool : allWords
    if (p.length < 4) return
    const word = p[Math.floor(Math.random() * p.length)] // 随机抽题是刻意行为
    const others = shuffle(allWords.filter((x) => x.w !== word.w)).slice(0, 3)
    setQuiz({ word, options: shuffle([word, ...others]), picked: null, review: false })
    sfx('pop')
  }

  const pick = (opt) => {
    if (!quiz || quiz.picked) return
    const correct = opt.w === quiz.word.w
    setQuiz({ ...quiz, picked: opt.w })
    dispatch({ type: 'ENGLISH_RESULT', word: quiz.word.w, correct })
    if (correct) {
      sfx('coin')
      reward(dispatch, { ...REWARDS.english, msg: `答对 ${quiz.word.w}${quiz.review ? '（复习）' : ''}`, icon: '🎉' })
      setTimeout(newQuiz, 1100)
    } else {
      sfx('oops')
      emit('toast', { icon: '📝', text: `正确答案是「${quiz.word.zh}」，已加入生词本` })
      setTimeout(newQuiz, 1600)
    }
  }

  const doImport = () => {
    const lines = importText.split('\n').map((x) => x.trim()).filter(Boolean)
    // 与内置词也查重：否则词库出现两个同名条目，测验会给出两个一模一样的选项
    const builtin = new Set(WORDS.map((x) => x.w))
    const parsed = lines.map(parseWordLine).filter(Boolean)
    const words = parsed.filter((x) => !builtin.has(x.w))
    const skipped = lines.length - words.length
    if (!words.length) {
      emit('toast', { icon: '📥', text: '没有收下新单词（格式不对，或都是已有词）' })
      sfx('oops')
      return
    }
    dispatch({ type: 'ENGLISH_IMPORT', words })
    emit('toast', { icon: '📥', text: `收下 ${words.length} 个新单词${skipped ? `，${skipped} 行跳过（格式不对或与已有词重复）` : ''}` })
    sfx('coin')
    setImportText('')
  }

  const rate = eng.right + eng.wrong ? Math.round((eng.right / (eng.right + eng.wrong)) * 100) : 0

  return (
    <>
      <div className="seg lang-seg">
        <button className={mode === 'flash' ? 'on' : ''} onClick={() => { setMode('flash'); sfx('click') }}>🎴 闪卡</button>
        <button className={mode === 'quiz' ? 'on' : ''} onClick={() => { setMode('quiz'); if (!quiz) newQuiz(); sfx('click') }}>🎯 小测验{dueWords.length > 0 ? ` (${dueWords.length})` : ''}</button>
        <button className={mode === 'book' ? 'on' : ''} onClick={() => { setMode('book'); sfx('click') }}>📖 生词本 ({(eng.queue || []).length})</button>
        <button className={mode === 'import' ? 'on' : ''} onClick={() => { setMode('import'); sfx('click') }}>📥 词单</button>
      </div>

      {mode === 'flash' && (
        <Panel title="翻翻卡" icon="🎴" extra={<span className="xp-pill">已掌握 {eng.known.length} / {allWords.length}</span>}>
          <Bar pct={(eng.known.length / allWords.length) * 100} color="gold" />
          <div className="flashcard" ref={cardRef} onClick={() => setFlipped(!flipped)} title="点击翻开">
            {!flipped ? (
              <div className="flash-front">
                <span className="flash-word">{current.w}</span>
                <span className="flash-pos">{current.pos}</span>
                <button className="tts-btn" title="听发音" onClick={(e) => { e.stopPropagation(); speak(current.w); sfx('click') }}>🔊 听发音</button>
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
        <Panel
          title="词义小测验" icon="🎯"
          extra={<span className="xp-pill">正确率 {rate}%（{eng.right}/{eng.right + eng.wrong}）</span>}
        >
          {!quiz ? (
            <div className="btn-row center"><Btn color="green" onClick={newQuiz}>开始测验 →</Btn></div>
          ) : (
            <div className="quiz">
              {quiz.review && <Chip color="orange" className="quiz-review">📌 到期复习 · 记忆的黄金时刻</Chip>}
              <div className="quiz-word">
                {quiz.word.w} <em>{quiz.word.pos}</em>
                <button className="tts-btn" title="听发音" onClick={() => { speak(quiz.word.w); sfx('click') }}>🔊</button>
              </div>
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
              {quiz.picked && <div className="btn-row center"><Btn size="sm" onClick={newQuiz}>下一题 →</Btn></div>}
            </div>
          )}
        </Panel>
      )}

      {mode === 'book' && (
        <Panel title="生词本" icon="📖" extra={<span className="xp-pill">{dueWords.length} 个今天该复习</span>}>
          {(eng.queue || []).length === 0 ? (
            <p className="empty">生词本空空的！做几道测验，答错的词会自动住进来。</p>
          ) : (
            <ul className="book-list">
              {[...(eng.queue || [])]
                .sort((a, b) => (a.due < b.due ? -1 : 1))
                .map((q) => {
                  const item = allWords.find((x) => x.w === q.w)
                  if (!item) return null
                  const dueIn = daysBetween(t, q.due)
                  return (
                    <li key={q.w} className={`card book-item ${dueIn <= 0 ? 'due' : ''}`}>
                      <b>{item.w}</b> <em>{item.pos}</em>
                      <button className="tts-btn" title="听发音" onClick={() => { speak(item.w); sfx('click') }}>🔊</button>
                      <span className="book-zh">{item.zh}</span>
                      <Chip color={dueIn <= 0 ? 'orange' : ''}>{dueIn <= 0 ? '今天该复习' : `${dueIn} 天后复习`}</Chip>
                      <Btn size="sm" color="green" onClick={() => { dispatch({ type: 'ENGLISH_KNOWN', word: q.w, known: true }); reward(dispatch, { xp: 2, msg: `复习 ${q.w}`, icon: '✨' }) }}>记住了</Btn>
                    </li>
                  )
                })}
            </ul>
          )}
          <p className="muted">答对会按遗忘曲线拉长下次复习的间隔（1 → 2 → 4 → 8 天…），连对到 7 天以上就毕业；答错立刻回到明天。记得常来点「小测验」！</p>
        </Panel>
      )}

      {mode === 'import' && (
        <Panel title="导入我的词单" icon="📥" extra={<span className="xp-pill">自定义 {custom.length} 个</span>}>
          <p className="muted">每行一个单词，支持「单词,词性,中文,例句」或最简单的「单词,中文」（逗号或 Tab 分隔）：</p>
          <textarea
            className="import-area"
            rows={6}
            aria-label="词单内容（每行一个单词：单词,词性,中文,例句 或 单词,中文）"
            value={importText}
            placeholder={'cozy,adj.,温暖舒适的,The pixel cabin feels cozy.\ntidy,整洁的'}
            onChange={(e) => setImportText(e.target.value)}
          />
          <div className="btn-row">
            <Btn color="green" disabled={!importText.trim()} onClick={doImport}>收进词库 ⬇</Btn>
          </div>
          {custom.length > 0 && (
            <>
              <h4 className="custom-title">我的词库</h4>
              <ul className="book-list">
                {custom.map((x) => (
                  <li key={x.w} className="card book-item">
                    <b>{x.w}</b> <em>{x.pos}</em>
                    <button className="tts-btn" title="听发音" onClick={() => { speak(x.w); sfx('click') }}>🔊</button>
                    <span className="book-zh">{x.zh}</span>
                    <button className="del" title="移出词库" onClick={() => dispatch({ type: 'ENGLISH_CUSTOM_DEL', w: x.w })}>×</button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>
      )}
    </>
  )
}
