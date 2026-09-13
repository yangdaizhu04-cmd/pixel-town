# 对标 ThreeUI 的设计优化方案（v0.8.0 候选草案）

> 状态：**待用户拍板**。参照系：`../threeui`（ThreeUI Community，MIT，React 19 + Three.js 组件库+展示站）。
> 结论先行：**只搬设计语言，不搬代码**。ThreeUI 的 shader 组件基于 three.js/WebGL，直接引入会让单文件从 0.63MB 涨到 1.5MB+ 且与像素风冲突；正确姿势是用 canvas 2D / CSS / GSAP 做像素化转译。

## 体积红线（已定）

**坚守 0.63MB 单文件形态**（gzip ~0.25MB）。每个新效果预算 ≤5KB 源码；不引入 three.js、不引入任何位图/图标库（硬性规则 9）、不破坏 file:// 双击可用（硬性规则 6 每次照验）。

## 方向清单

### A. 专注氛围背景 ⭐推荐（对标 ThreeUI `crt` / Constellation Field）
- **现状**：番茄钟点「开始专注」后页面无场景变化，只有计时数字。
- **方案**：专注进行中时，学习页背景切入像素风氛围层——CRT 扫描线（2px 间隔半透明横纹）+ 四角暗角 + 轻微色偏，或极简像素星空。canvas 2D 绘制，暂停/结束 300ms 淡出。
- **约束**：`prefers-reduced-motion` 时只保留静态扫描线不做闪烁；专注声音面板不受影响。
- **预估**：`src/lib/ambience.js`（新，~120 行）+ Study.jsx 挂载点 + CSS ~30 行。约 5KB。

### B. 夜间星空氛围 ⭐推荐（对标 ThreeUI 深色场景层次）
- **现状**：夜间时段只换配色（`--sky3` 系），背景无动态层次。
- **方案**：夜间主题下背景加低频像素星点（三档大小、错峰闪烁）+ 偶发流星（每 20~40s 一颗）+ 云影漂移减速。GSAP 实现，遵守 `fromTo + overwrite` 规则。
- **约束**：只在夜间时段主题激活；白天零开销（条件渲染）；reduced-motion 时星星静态。
- **预估**：`src/components/NightSky.jsx`（新，~100 行）+ App 背景层挂载。约 4KB。

### C. UI 微交互打磨（对标 ThreeUI skeuomorphic-toggle / Animated Top Dock）
- 声音面板 checkbox → **像素拨杆开关**（复用字符画体系新画 2 帧：开/关），全站可复用组件 `PixelToggle`。
- 侧边导航 hover/active 加像素 squash & stretch 微弹跳（GSAP，reduced-motion 降级为无动效）。
- 全站按钮按压反馈统一「下沉 1px + 已有 8-bit 音效」。
- **预估**：`PixelToggle.jsx` ~60 行 + global.css 微调 + 各处替换。

### D. 空状态微动画（对标 ThreeUI 空态 live 感）
- 现状：空状态是静态 emoji+一句话（如学习页「先立一个小目标吧！」📚）。
- 方案：用 sprites.jsx 字符画体系给 3~4 个高频空状态做 2 帧像素动画（书页翻动、番茄轻晃、阿咕眨眼）。
- **预估**：sprites.jsx 追加 ~40 行 + 各空状态接入。

## 排期建议

A → B → C → D 依次做，每项独立可交付、独立验证（lint 0 / 测试全过 / build 体积对比 / file:// 双击验证 / Chrome 截图走查），做完一项 bump 一次版本号（硬性规则 10）。

## 明确不搬（评估记录）

| ThreeUI 特性 | 不搬原因 |
|---|---|
| three.js 全部 3D 组件 | 体积（+0.9MB 起）与像素风双重冲突，违背单文件红线 |
| 浏览网格 / 变体选择器 / 源码 Tab | 产品形态不同（组件库目录 vs 单应用） |
| 双 three 版本别名架构 | 与本问题无关 |
| 任何位图/图标资产 | 硬性规则 9 |
| ThreeUI 主题系统形态（6 主题按钮） | pixel-town 昼夜时段自动切换已更贴合"生活工作台"，手动多主题是伪需求（除非用户要） |

## 关联

- 本方案独立于 [待优化.md](./待优化.md) 的「后续可做」工程项（云同步验证/sync 瘦身/周报问答率/成就扩展/Dashboard 拖拽），两者不互斥。
- 落地后：更新 [待优化.md](./待优化.md)、[项目交接文档.md](./项目交接文档.md)、[README.md](./README.md)，新坑进 [踩坑指南.md](./踩坑指南.md)。
