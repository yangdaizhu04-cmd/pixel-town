// ---------- 小镇商店：金币的主要去处（没有水槽的经济会通胀） ----------
// MAX_POTS：3 个基础盆 + 2 个可购买盆
export const MAX_POTS = 5
// 采集一朵盛开的植物换多少金币（盆清空、品种进图鉴）
export const HARVEST_COINS = 6

export const PLANT_META = [
  { id: 'sunflower', name: '向日葵', cost: 0, desc: '小镇的招牌，免费领养' },
  { id: 'tulip', name: '小郁金香', cost: 0, desc: '风一吹就轻轻晃' },
  { id: 'berry', name: '小浆果', cost: 0, desc: '结的果子红红的' },
  { id: 'cactus', name: '仙人掌', cost: 30, desc: '一周忘浇水也没事' },
  { id: 'lavender', name: '薰衣草', cost: 45, desc: '香香的，助眠' },
  { id: 'mushroom', name: '小蘑菇', cost: 40, desc: '雨后才肯露头' },
]
export const plantName = (id) => (PLANT_META.find((x) => x.id === id) || {}).name || '??'

export const POT_GOODS = [
  { id: 'pot-4', name: '第四个花盆', cost: 60, desc: '花园扩容一格' },
  { id: 'pot-5', name: '第五个花盆', cost: 120, desc: '花园再扩一格' },
]

export const DECOR_GOODS = [
  { id: 'fence', name: '小篱笆', cost: 50, desc: '围出一片小花园' },
  { id: 'scare', name: '稻草人', cost: 80, desc: '麻雀来了也不怕' },
  { id: 'lamp', name: '路灯', cost: 65, desc: '晚归也有光' },
  { id: 'pond', name: '小池塘', cost: 90, desc: '倒映着云' },
]

export const HAT_GOODS = [
  { id: 'hat_leaf', name: '叶子帽', cost: 20, desc: '春天限定的清爽' },
  { id: 'hat_berry', name: '浆果帽', cost: 25, desc: '看起来很好吃的样子' },
  { id: 'hat_crown', name: '金皇冠', cost: 60, desc: '阿咕宣布自己加冕了' },
]
