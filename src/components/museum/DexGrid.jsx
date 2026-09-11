import React from 'react'
import { PixelSprite } from '../../lib/sprites.jsx'
import { PLANT_META } from '../../lib/shop.js'

// ---------- 植物图鉴 ----------
export default function DexGrid({ state }) {
  const { collection = [], unlockedKinds = [] } = state.profile
  return (
    <div className="dex-grid">
      {PLANT_META.map((p) => {
        const bloomed = collection.includes(p.id)
        const unlocked = unlockedKinds.includes(p.id)
        return (
          <div key={p.id} className={`dex-item card ${bloomed ? '' : 'dim'}`}>
            <PixelSprite name={bloomed ? `bloom_${p.id}` : unlocked ? 'p3' : 'pot_empty'} scale={4} className={bloomed ? '' : 'dim'} />
            <b>{unlocked ? p.name : '？？？'}</b>
            <span className="dex-note">{bloomed ? '已盛开 ✓' : unlocked ? '种下后等你养到盛开' : '商店里有它的种子'}</span>
          </div>
        )
      })}
    </div>
  )
}
