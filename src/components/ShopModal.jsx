import React, { useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { Modal, Btn, Chip } from './ui.jsx'
import { PixelSprite } from '../lib/sprites.jsx'
import { MAX_POTS, PLANT_META, DECOR_GOODS, HAT_GOODS } from '../lib/shop.js'
import { sfx, emit } from '../lib/gamify.js'

const TABS = [
  { id: 'pot', label: '🪴 花盆' },
  { id: 'seed', label: '🌰 种子' },
  { id: 'decor', label: '🏡 装饰' },
  { id: 'hat', label: '🎩 阿咕的帽子' },
]

function Item({ name, desc, cost, sprite, owned, disabled, reason, onBuy }) {
  return (
    <div className={`shop-item card ${owned ? 'owned' : ''}`}>
      {sprite && <PixelSprite name={sprite} scale={3} />}
      <div className="shop-info">
        <b>{name}</b>
        <span className="shop-desc">{desc}</span>
      </div>
      {owned ? (
        <Chip color="green">已拥有</Chip>
      ) : (
        <Btn size="sm" color="gold" disabled={disabled} title={reason} onClick={onBuy}>🪙 {cost}</Btn>
      )}
    </div>
  )
}

export default function ShopModal({ open, onClose }) {
  const { state, dispatch } = useApp()
  const [tab, setTab] = useState('pot')
  const { profile } = state
  const coins = profile.coins

  const buy = (goods, id, cost) => {
    if (coins < cost) {
      emit('toast', { icon: '🪙', text: '金币不够啦，完成今天的冒险再来看看～' })
      sfx('oops')
      return
    }
    dispatch({ type: 'SHOP_BUY', goods, id, cost })
    sfx('buy')
    emit('toast', { icon: '🛒', text: '买好啦，谢谢惠顾！' })
  }

  const potCount = profile.pots.length
  const seedOwned = (id) => (profile.unlockedKinds || []).includes(id)
  const decorOwned = (id) => (profile.decor || []).includes(id)

  return (
    <Modal open={open} onClose={onClose} title="🛒 小镇商店" wide>
      <div className="shop">
        <p className="shop-coins">钱包里有 <b>🪙 {coins}</b> 金币——完成任务赚来的，花掉才更有动力赚！</p>
        <div className="seg shop-tabs">
          {TABS.map((x) => (
            <button key={x.id} className={tab === x.id ? 'on' : ''} onClick={() => { setTab(x.id); sfx('click') }}>{x.label}</button>
          ))}
        </div>

        {tab === 'pot' && (
          <div className="shop-list">
            <Item
              name="第四个花盆" desc="花园扩容一格" cost={60} sprite="pot_empty"
              disabled={potCount >= MAX_POTS}
              reason={potCount >= MAX_POTS ? '花园已经满啦' : ''}
              owned={potCount >= 4}
              onBuy={() => buy('pot', 'pot-4', 60)}
            />
            <Item
              name="第五个花盆" desc="花园再扩一格" cost={120} sprite="pot_empty"
              disabled={potCount >= MAX_POTS}
              reason={potCount >= MAX_POTS ? '花园已经满啦' : ''}
              owned={potCount >= 5}
              onBuy={() => buy('pot', 'pot-5', 120)}
            />
            {potCount >= MAX_POTS && <p className="muted">花园位置已全部解锁（{MAX_POTS} 盆）。</p>}
          </div>
        )}

        {tab === 'seed' && (
          <div className="shop-list">
            {PLANT_META.filter((p) => p.cost > 0).map((p) => (
              <Item
                key={p.id} name={p.name} desc={p.desc} cost={p.cost} sprite={`bloom_${p.id}`}
                owned={seedOwned(p.id)}
                onBuy={() => buy('seed', p.id, p.cost)}
              />
            ))}
            <p className="muted">买下的种子永久解锁；去首页花园的空花盆里种下它。植物盛开后再「采集种子」能换金币哦。</p>
          </div>
        )}

        {tab === 'decor' && (
          <div className="shop-list">
            {DECOR_GOODS.map((d) => (
              <Item
                key={d.id} name={d.name} desc={d.desc} cost={d.cost} sprite={`decor_${d.id}`}
                owned={decorOwned(d.id)}
                onBuy={() => buy('decor', d.id, d.cost)}
              />
            ))}
          </div>
        )}

        {tab === 'hat' && (
          <div className="shop-list">
            {HAT_GOODS.map((h) => (
              <Item
                key={h.id} name={h.name} desc={h.desc} cost={h.cost} sprite={h.id}
                owned={profile.hat === h.id}
                onBuy={() => buy('hat', h.id, h.cost)}
              />
            ))}
            <p className="muted">帽子一次只能戴一顶，新买的会自动戴上，聊天页能看到～</p>
          </div>
        )}
      </div>
      <div className="modal-foot">
        <Btn onClick={onClose}>逛完啦</Btn>
      </div>
    </Modal>
  )
}
