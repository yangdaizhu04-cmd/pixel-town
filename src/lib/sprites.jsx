import { useEffect, useRef } from 'react'

// ---------- 调色板 ----------
const C = {
  ink: '#4a3b2a',
  gold: '#ffd34e',
  goldD: '#d9a426',
  cream: '#fff3c0',
  orange: '#f5a742',
  red: '#e2695e',
  redD: '#c4544a',
  pink: '#f3a0b5',
  blue: '#5fb7e5',
  blueL: '#b8e3f7',
  blueD: '#3a8fc0',
  green: '#7cc36a',
  greenD: '#4f9e4c',
  greenDD: '#2f7a3f',
  potL: '#c98a5b',
  potD: '#8a5a38',
  soil: '#6b4a32',
  white: '#ffffff',
  cloudD: '#dfeef5',
  paper: '#fffdf4',
  line: '#d9c294',
}

const V = (obj) => obj // 可读性别名

// ---------- 精灵图（每行一个字符串，'.' 为透明） ----------
const SPRITES = {
  coin: {
    pal: V({ a: C.gold, b: C.cream, c: C.goldD }),
    rows: [
      '..aaaa..',
      '.abbaaa.',
      'aabbaaaa',
      'aaaaaaac',
      'aaaaaaac',
      '.aaaaaac',
      '..cccc..',
    ],
  },
  gift: {
    pal: V({ r: C.red, R: C.redD, g: C.gold }),
    rows: [
      '.gg....gg.',
      '..gggggg..',
      'rrrrggggrr',
      'rrrrggggrr',
      '.rrrggrrr.',
      '.rrrggrrr.',
      '.rrrggrrr.',
      '.rrrggrrr.',
      '.rrrggrrr.',
      '.RRRRRRRR.',
    ],
  },
  star: {
    pal: V({ a: C.gold }),
    rows: [
      '...aa...',
      '...aa...',
      'aaaaaaaa',
      '.aaaaaa.',
      '..aaaa..',
      '.aa..aa.',
      'aa....aa',
    ],
  },
  heart: {
    pal: V({ a: C.red }),
    rows: [
      '.aa..aa.',
      'aaaaaaaa',
      'aaaaaaaa',
      '.aaaaaa.',
      '..aaaa..',
      '...aa...',
    ],
  },
  drop: {
    pal: V({ a: C.blue, b: C.blueL, c: C.blueD }),
    rows: [
      '..aa..',
      '..aa..',
      '.baaa.',
      'aaaaaa',
      'aaaaaa',
      'aaaaaa',
      '.aaaa.',
      '..cc..',
    ],
  },
  flame: {
    pal: V({ r: C.red, o: C.orange, y: C.gold }),
    rows: [
      '....r...',
      '...rr...',
      '...rro..',
      '..rroo..',
      '..rooo..',
      '.royyoo.',
      '.royyyo.',
      '.royyyo.',
      '..oyyo..',
      '...oo...',
    ],
  },
  sun: {
    pal: V({ a: C.gold, b: C.cream }),
    rows: [
      '.....aa.....',
      '.....aa.....',
      '...aaaaaa...',
      '..abbaaaaa..',
      '..abbaaaaa..',
      'aa.aaaaaa.aa',
      'aa.aaaaaa.aa',
      '..aaaaaaaa..',
      '...aaaaaa...',
      '.....aa.....',
      '.....aa.....',
      '............',
    ],
  },
  cloud: {
    pal: V({ a: C.white, b: C.cloudD }),
    rows: [
      '....aaaa........',
      '...aaaaaa..aa...',
      '..aaaaaaaa.aaa..',
      '.aaaaaaaaaaaaaa.',
      'aaaaaaaaaaaaaaaa',
      'aaaaaaaaaaaaaaaa',
      '.abbbbbbbbbbbba.',
      '..bbbbbbbbbbbb..',
    ],
  },
  mail: {
    pal: V({ p: C.paper, l: C.line, r: C.red }),
    rows: [
      'llllllllllll',
      'lp........pl',
      'lpl......lpl',
      'lppp....pppl',
      'lpppprrppppl',
      'lppppppppppl',
      'lppppppppppl',
      'llllllllllll',
    ],
  },
  // ---- 小镇精灵「阿咕」 ----
  bird: {
    pal: V({ b: '#ffe08a', w: '#fff6dd', o: C.orange, e: C.ink, c: '#e8b04f' }),
    rows: [
      '....bbbb......',
      '...bbbbbb.....',
      '...bebbeb.....',
      '...bbbbbb.....',
      '....oooo......',
      '..bbbbbbbb....',
      '.bcwwwwwwcb...',
      '.bcwwwwwwcb...',
      '.bcwwwwwwcb...',
      '..bwwwwwwb....',
      '...bbbbbb.....',
      '....o..o......',
      '...oo..oo.....',
      '..............',
    ],
  },
}

// ---- 花盆共享（12x14，盆体在第 9~13 行） ----
const POT_ROWS = [
  '.pppppppppp.',
  '..pppppppp..',
  '..pppppppp..',
  '..qqqqqqqq..',
  '...qqqqqq...',
]
const POT_PAL = V({ p: C.potL, q: C.potD })
const PLANT_TOPS = {
  p0: [
    '............',
    '............',
    '............',
    '............',
    '............',
    '............',
    '............',
    '............',
    '.....ss.....',
  ],
  p1: [
    '............',
    '............',
    '............',
    '............',
    '............',
    '...GG..GG...',
    '....GGGG....',
    '.....GG.....',
    '.....GG.....',
  ],
  p2: [
    '............',
    '............',
    '............',
    '..GG....GG..',
    '.GGGG..GGGG.',
    '..GGGGGGGG..',
    '.....GG.....',
    '.....GG.....',
    '.....GG.....',
  ],
  p3: [
    '............',
    '.....ff.....',
    '....ffff....',
    '....ffff....',
    '.....GG.....',
    '.....GG.....',
    '..GG.GG.GG..',
    '.....GG.....',
    '.....GG.....',
  ],
  bloom_sun: [
    '...yyyyyy...',
    '..yyooooyy..',
    '..yooooooy..',
    '..yyooooyy..',
    '...yyyyyy...',
    '.....GG.....',
    '..GGG..GGG..',
    '.....GG.....',
    '.....GG.....',
  ],
  bloom_tulip: [
    '..FF.FF.FF..',
    '..FFFFFFFF..',
    '..FFFFFFFF..',
    '...FFFFFF...',
    '....GGGG....',
    '.....GG.....',
    '..GGG..GGG..',
    '.....GG.....',
    '.....GG.....',
  ],
  bloom_berry: [
    '............',
    '...GGGGGG...',
    '..GGrrGGrr..',
    '..GGGGGGGG..',
    '..GrrGGrrG..',
    '...GGGGGG...',
    '.....GG.....',
    '.....GG.....',
    '.....GG.....',
  ],
}
// 顶部 9 行 + 花盆 5 行 = 14 行
for (const [name, top] of Object.entries(PLANT_TOPS)) {
  SPRITES[name] = {
    pal: { ...POT_PAL, G: C.greenD, d: C.greenDD, f: C.pink, F: C.red, y: C.gold, o: C.orange, r: C.red, s: C.potD },
    rows: [...top, ...POT_ROWS],
  }
}

// ---- 心情脸（10x9，程序化生成 5 档表情） ----
function face(mouth, { tear = false, blush = true } = {}) {
  const rows = [
    '...ffff...',
    '..ffffff..',
    '.ffffffff.',
    '.ffffffff.',
    'ffffffffff',
    'ffffffffff',
    '.ffffffff.',
    '..ffffff..',
    '...ffff...',
  ]
  const put = (r, c, ch) => {
    rows[r] = rows[r].slice(0, c) + ch + rows[r].slice(c + 1)
  }
  // 眼睛
  put(3, 2, 'e'); put(3, 3, 'e'); put(3, 6, 'e'); put(3, 7, 'e')
  // 嘴巴
  for (const [r, c, ch] of mouth) put(r, c, ch)
  // 腮红
  if (blush) { put(5, 1, 'c'); put(5, 8, 'c') }
  if (tear) { put(5, 8, 'b'); put(6, 8, 'b') }
  return rows
}
const E = 'e'
SPRITES.mood0 = { pal: { f: C.gold, e: C.ink, c: C.pink, b: C.blue }, rows: face([[5, 3, E], [5, 4, E], [5, 5, E], [5, 6, E], [6, 2, E], [6, 7, E]]) } // 开心
SPRITES.mood1 = { pal: SPRITES.mood0.pal, rows: face([[6, 3, E], [6, 4, E], [6, 5, E], [6, 6, E]]) } // 微笑
SPRITES.mood2 = { pal: SPRITES.mood0.pal, rows: face([[6, 3, E], [6, 4, E], [6, 5, E]], { blush: false }) } // 平静
SPRITES.mood3 = { pal: SPRITES.mood0.pal, rows: face([[5, 2, E], [5, 7, E], [6, 3, E], [6, 4, E], [6, 5, E], [6, 6, E]], { blush: false }) } // 低落
SPRITES.mood4 = { pal: SPRITES.mood0.pal, rows: face([[5, 3, E], [5, 4, E], [5, 5, E], [6, 4, E]], { tear: true, blush: false }) } // 难过

export function PixelSprite({ name, scale = 5, className = '', style, title }) {
  const ref = useRef(null)
  const sp = SPRITES[name]
  useEffect(() => {
    const c = ref.current
    if (!c || !sp) return
    c.width = sp.rows[0].length
    c.height = sp.rows.length
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, c.width, c.height)
    sp.rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const col = sp.pal[row[x]]
        if (col) {
          ctx.fillStyle = col
          ctx.fillRect(x, y, 1, 1)
        }
      }
    })
  }, [name]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!sp) return null
  return (
    <canvas
      ref={ref}
      className={`px-sprite ${className}`}
      title={title}
      aria-label={title}
      style={{ width: sp.rows[0].length * scale, height: sp.rows.length * scale, ...style }}
    />
  )
}

export default PixelSprite
