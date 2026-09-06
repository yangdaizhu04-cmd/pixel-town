#!/usr/bin/env bash
# ============================================================
# 拾光小镇 · 一键上传 GitHub
# 用法：
#   bash upload.sh            → 自动生成「更新：日期时间」提交信息
#   bash upload.sh 修了XX问题  → 用指定文字作为提交信息
#   或直接双击「一键上传.bat」
# 行为：git add -A → commit → push；远端领先时自动 rebase 再推一次
# ============================================================
set -e
cd "$(dirname "$0")"

# ---------- 0. 环境自检 ----------
if ! command -v git >/dev/null 2>&1; then
  echo "[×] 没找到 git，请先安装 Git for Windows"
  exit 1
fi
if [ ! -d .git ]; then
  echo "[×] 这里不是 git 仓库（没有 .git 目录）"
  exit 1
fi

# ---------- 1. git 身份兜底（没配置过就用 GitHub 用户名 + noreply 邮箱） ----------
if [ -z "$(git config user.name)" ] || [ -z "$(git config user.email)" ]; then
  git config user.name "yangdaizhu04-cmd"
  git config user.email "yangdaizhu04-cmd@users.noreply.github.com"
  echo "[i] 首次运行：已为本仓库配置提交身份（yangdaizhu04-cmd）"
fi

# ---------- 2. 提交信息 ----------
MSG="$*"
if [ -z "$MSG" ]; then
  MSG="更新：$(date '+%Y-%m-%d %H:%M')"
fi

# ---------- 3. 没有变更就直接收工 ----------
if git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
  echo "[√] 没有需要上传的变更，小镇已是最新。"
  exit 0
fi

echo "[1/3] 暂存所有变更..."
git add -A

echo "[2/3] 提交：$MSG"
if ! git commit -m "$MSG"; then
  echo "[i] 没有产生新提交（可能内容与上次相同），跳过推送。"
  exit 0
fi

echo "[3/3] 推送到 GitHub..."
if git push; then
  echo "[√] 上传成功！仓库地址：https://github.com/yangdaizhu04-cmd/pixel-town"
  exit 0
fi

# push 失败：远端比本地新 → rebase 后重试一次
echo "[i] 远端有新内容，自动同步后重试..."
if git pull --rebase origin main && git push; then
  echo "[√] 上传成功！仓库地址：https://github.com/yangdaizhu04-cmd/pixel-town"
else
  echo "[×] 自动同步失败，可能有冲突。请手动执行：git status 查看冲突文件，解决后 git push"
  exit 1
fi
