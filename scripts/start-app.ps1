# 一键启动「拾光小镇」开发服务器并自动打开浏览器
# 由根目录「一键启动.bat」调用；也可在 PowerShell 里直接执行本脚本。
#
# 逻辑：找一个 5173 起的空闲端口 → 新开一个 cmd 窗口跑
#   `npm run dev -- --port P --strictPort`（固定端口，绝不会 +1 换端口），
# 然后对这个端口发起 https 探测，就绪后用默认浏览器打开。
# dev 窗口保留在前台，关掉它即停止服务器。
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot   # pixel-town/
if (!(Test-Path (Join-Path $root 'node_modules'))) {
  Write-Host '还没装依赖，先跑一次 npm install' -ForegroundColor Yellow
  Start-Process cmd.exe -ArgumentList '/k', 'npm install'
  exit 1
}

# 找一个空闲端口（5173 起，避开已被占用的）
function Get-FreePort {
  param([int]$start)
  $used = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | ForEach-Object { $_.LocalPort }
  for ($p = $start; $p -lt $start + 30; $p++) { if ($used -notcontains $p) { return $p } }
  return $start
}

$port = Get-FreePort 5173

# 新开 cmd 窗口跑 dev（strictPort 固定端口；.https/ 存在时 vite 自动切 HTTPS）
Write-Host "正在启动开发服务器（端口 $port）……"
Start-Process cmd.exe -ArgumentList '/k', "cd /d `"$root`" && npm run dev -- --port $port --strictPort"

$url = "https://localhost:$port/"
$ok = $false
for ($i = 0; $i -lt 24; $i++) {   # 最多等 12 秒
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
    if ($r.StatusCode -eq 200) { $ok = $true; break }
  } catch {
    # 服务器还没就绪，继续等
  }
  Start-Sleep -Milliseconds 500
}

if ($ok) {
  Start-Process $url
  Write-Host "✅ 已用默认浏览器打开 $url" -ForegroundColor Green
  Write-Host '开发服务器在独立窗口运行中，关闭那个窗口即停止。' -ForegroundColor DarkGreen
} else {
  Write-Host '服务器启动超时，请看一下 dev 窗口里的报错。' -ForegroundColor Red
  Write-Host "若一切正常，可手动打开 $url"
}