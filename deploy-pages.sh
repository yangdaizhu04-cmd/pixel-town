#!/usr/bin/env bash
# ============================================================
# 拾光小镇 · 一键发布线上网页（GitHub Pages）
# 用法：
#   bash deploy-pages.sh        → 构建 + 发布到线上
#   或直接双击「一键发布网页.bat」
# 行为：npm run build → 把 dist/ 推到 gh-pages 分支（1~2 分钟后生效）
# 线上地址：https://yangdaizhu04-cmd.github.io/pixel-town/
# 注意：首次发布需要在仓库 Settings → Pages 里选一次 gh-pages 分支（只需一次）
# ============================================================
set -e
cd "$(dirname "$0")"
PROJECT_DIR="$(pwd)"

# ---------- 0. 环境自检 ----------
if ! command -v git >/dev/null 2>&1; then
  echo "[×] 没找到 git，请先安装 Git for Windows"
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "[×] 没找到 npm，请先安装 Node.js"
  exit 1
fi

echo "[1/3] 构建最新版本（npm run build）..."
npm run build

echo "[2/3] 准备发布内容..."
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp -r dist/. "$TMP"/
touch "$TMP/.nojekyll"   # 关闭 GitHub Pages 的 Jekyll 处理，避免部分文件被忽略
cd "$TMP"
git init -q -b gh-pages
git config user.name  "$(git -C "$PROJECT_DIR" config user.name  || echo yangdaizhu04-cmd)"
git config user.email "$(git -C "$PROJECT_DIR" config user.email || echo yangdaizhu04-cmd@users.noreply.github.com)"
git add -A
git commit -q -m "deploy: 线上发布 $(date '+%Y-%m-%d %H:%M')"

echo "[3/3] 推送到 gh-pages 分支..."
git push -q -f git@github.com:yangdaizhu04-cmd/pixel-town.git gh-pages

echo "[√] 发布完成！1~2 分钟后访问："
echo "    https://yangdaizhu04-cmd.github.io/pixel-town/"
