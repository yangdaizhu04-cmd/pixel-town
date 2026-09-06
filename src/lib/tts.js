// ---------- 单词发音（浏览器自带 TTS，离线免费） ----------
// 注意：部分浏览器要求先有用户手势才允许出声；本项目只在点击事件里调用，天然满足。
export function speak(text, rate = 0.9) {
  try {
    if (!('speechSynthesis' in window) || !text) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'
    u.rate = rate
    window.speechSynthesis.speak(u)
  } catch { /* 语音不可用时静默 */ }
}
