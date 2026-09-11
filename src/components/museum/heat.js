// 热力图配色：Heatmap 与 ShareCard 共用（金色 = 冲破 90 XP 的日子）
export const HEAT = ['#efe3c4', '#cfe8b8', '#a8d78d', '#79b851', '#ffd34e']
export const heatIdx = (xp) => (xp <= 0 ? 0 : xp < 30 ? 1 : xp < 60 ? 2 : xp < 90 ? 3 : 4)
