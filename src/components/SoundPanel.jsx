import React, { useEffect, useState } from 'react'
import {
  SOUND_IDS, soundPrefs, soundSubscribe, soundToggle, soundVol,
  soundMaster, soundLabel, soundSetAutoFocus, soundStopAll,
} from '../lib/sound.js'
import { Btn } from './ui.jsx'

const ICONS = { rain: '🌧️', white: '🌫️', fire: '🔥', piano: '🎹' }

// 专注声音面板：四路合成音源混音 + 主音量。挂在学习页番茄钟下面。
// 组件自身是纯展示 + 调用 sound.js 的开关，状态以 sound.js 为单一真相（subscribe 回调刷新）。
export default function SoundPanel() {
  const [prefs, setPrefs] = useState(soundPrefs)
  useEffect(() => soundSubscribe(setPrefs), [])

  const anyOn = SOUND_IDS.some((id) => prefs.active[id])

  return (
    <div className="sound-panel">
      <div className="sound-row">
        <span className="sound-title">🎧 专注声音</span>
        <div className="sound-chips">
          {SOUND_IDS.map((id) => (
            <button
              key={id}
              className={`sound-chip ${prefs.active[id] ? 'on' : ''}`}
              title={`${soundLabel(id)}（合成音，无音频文件）`}
              onClick={() => soundToggle(id)}
            >
              {ICONS[id]} {soundLabel(id)}
            </button>
          ))}
          {anyOn && <Btn size="sm" onClick={soundStopAll} title="全部关掉">全关</Btn>}
        </div>
      </div>
      {anyOn && (
        <div className="sound-mix">
          {SOUND_IDS.filter((id) => prefs.active[id]).map((id) => (
            <label key={id} className="sound-vol">
              <span>{ICONS[id]}</span>
              <input
                type="range" min="0" max="1" step="0.01"
                value={prefs.vol[id]}
                aria-label={`${soundLabel(id)}音量`}
                onChange={(e) => soundVol(id, +e.target.value)}
              />
            </label>
          ))}
          <label className="sound-vol master">
            <span>🔊</span>
            <input
              type="range" min="0" max="1" step="0.01"
              value={prefs.vol.master}
              aria-label="总音量"
              onChange={(e) => soundMaster(+e.target.value)}
            />
          </label>
        </div>
      )}
      <label className="check-line">
        <input
          type="checkbox"
          checked={!!prefs.autoFocus}
          onChange={(e) => soundSetAutoFocus(e.target.checked)}
        />
        <span>🍅 开始专注时自动打开上次的声音组合</span>
      </label>
    </div>
  )
}
