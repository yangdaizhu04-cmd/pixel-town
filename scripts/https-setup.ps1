# scripts/https-setup.ps1 — 本地 HTTPS 证书一键生成（PWA 真机安装必需 https）
# 优先用 mkcert（本地根 CA 自动信任），没有就自动从 GitHub 下载；
# 下载失败时回退到 openssl 离线自签（也支持）。生成证书覆盖 localhost + 本机全部局域网 IP。
# 证书/私钥放在 .https/（已 gitignore），换 IP 或过期后重跑本脚本即可。
param()
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$dir = Join-Path $root '.https'
New-Item -ItemType Directory -Force -Path $dir | Out-Null

$ips = @()
Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike '169.254.*' -and $_.IPAddress -ne '127.0.0.1' } |
  ForEach-Object { $ips += $_.IPAddress }

# ---------- 找 mkcert ----------
$mkcert = (Get-Command mkcert -ErrorAction SilentlyContinue).Source
if (-not $mkcert) {
  foreach ($cand in @("$env:USERPROFILE\.local\bin\mkcert.exe", "$env:LOCALAPPDATA\mkcert.exe", "$env:USERPROFILE\go\bin\mkcert.exe", "$env:ProgramFiles\mkcert\mkcert.exe")) {
    if (Test-Path $cand) { $mkcert = $cand; break }
  }
}
if (-not $mkcert) {
  Write-Host '未找到 mkcert，尝试从 GitHub 自动下载…'
  $dest = "$env:LOCALAPPDATA\mkcert.exe"
  $urls = @(
    'https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-windows-amd64.exe',
    'https://ghproxy.net/https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-windows-amd64.exe'
  )
  foreach ($u in $urls) {
    try {
      Invoke-WebRequest -Uri $u -OutFile $dest -TimeoutSec 90 -UseBasicParsing
      $mkcert = $dest
      Write-Host "下载成功：$u"
      break
    } catch { Write-Host "下载失败（$u）：$($_.Exception.Message)" }
  }
  if (-not $mkcert) { Write-Host '所有镜像均失败，回退到 openssl 方案。' }
}

if ($mkcert) {
  Write-Host "使用 mkcert：$mkcert"
  # 安装/信任本地根 CA（stderr 提示算正常；写系统存储需要管理员，失败就装到当前用户受信任根）
  $caRoot = 'C:\'
  try { & $mkcert -install 2>&1 | Out-Null } catch { } # 忽略“CA 已存在”之类的普通提示
  $caRoot = (& $mkcert -CAROOT).Trim()
  $caPem = Join-Path $caRoot 'rootCA.pem'
  $trusted = Get-ChildItem Cert:\CurrentUser\Root -ErrorAction SilentlyContinue | Where-Object { $_.Subject -like '*mkcert*' }
  if (-not $trusted -and -not (Get-ChildItem Cert:\LocalMachine\Root -ErrorAction SilentlyContinue | Where-Object { $_.Subject -like '*mkcert*' })) {
    Write-Host '根 CA 尚未被系统信任，加入「当前用户」受信任根…'
    Import-Certificate -FilePath $caPem -CertStoreLocation Cert:\CurrentUser\Root | Out-Null
  }
  # 为 localhost + 全部局域网 IP 签发证书（keys 为 PKCS#8，vite/node 可直接用）
  $args = @('-key-file', (Join-Path $dir 'key.pem'), '-cert-file', (Join-Path $dir 'cert.pem'), 'localhost', '127.0.0.1', '::1') + $ips
  & $mkcert @args
  if ($LASTEXITCODE -ne 0) { throw 'mkcert 签发失败' }
  $caRoot = (& $mkcert -CAROOT).Trim()
  Copy-Item (Join-Path $caRoot 'rootCA.pem') (Join-Path $dir 'ca.pem') -Force
  $phoneCA = Join-Path $dir 'ca.pem'
} else {
  Write-Host 'openssl 自签方案（离线兜底）…'
  $ossl = (Get-Command openssl -ErrorAction SilentlyContinue).Source
  if (-not $ossl) { $c = 'C:\Users\echo\miniconda3\Library\bin\openssl.exe'; if (Test-Path $c) { $ossl = $c } }
  if (-not $ossl) { throw '既没有 mkcert 也没有 openssl，无法生成证书。' }

  function Invoke-Ossl { & $ossl @Args; if ($LASTEXITCODE -ne 0) { throw "openssl 执行失败（exit $LASTEXITCODE）" } }

  $caKey = Join-Path $dir 'ca.key'; $caPemCert = Join-Path $dir 'ca.pem'
  if (-not (Test-Path $caPemCert) -or -not (Test-Path $caKey)) {
    Invoke-Ossl req -x509 -newkey rsa:2048 -nodes -keyout $caKey -out $caPemCert -days 3650 -subj '/CN=PickupTown Local CA' -addext 'basicConstraints=critical,CA:TRUE' -addext 'keyUsage=critical,keyCertSign,cRLSign'
  }
  $sans = @('DNS:localhost', 'IP:127.0.0.1', 'IP:::1') + ($ips | ForEach-Object { 'IP:' + $_ })
  $ext = Join-Path $dir 'server-ext.cnf'
  Set-Content -Path $ext -Value "[v3_req]`nsubjectAltName=$($sans -join ',')`nbasicConstraints=CA:FALSE`nkeyUsage=digitalSignature,keyEncipherment`nextendedKeyUsage=serverAuth"
  Invoke-Ossl req -new -newkey rsa:2048 -nodes -keyout (Join-Path $dir 'key.pem') -out (Join-Path $dir 'server.csr') -subj '/CN=PickupTown'
  Invoke-Ossl x509 -req -days 398 -in (Join-Path $dir 'server.csr') -CA $caPemCert -CAkey $caKey -CAcreateserial -out (Join-Path $dir 'cert.pem') -extfile $ext -extensions v3_req
  Remove-Item (Join-Path $dir 'server.csr') -ErrorAction SilentlyContinue
  $trusted = Get-ChildItem Cert:\CurrentUser\Root -ErrorAction SilentlyContinue | Where-Object { $_.Subject -like '*PickupTown Local CA*' }
  if (-not $trusted) { Import-Certificate -FilePath $caPemCert -CertStoreLocation Cert:\CurrentUser\Root | Out-Null }
  $phoneCA = $caPemCert
}

$local = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '169.254.*' -and $_.IPAddress -ne '127.0.0.1' } | Select-Object -First 1).IPAddress

Write-Host ''
Write-Host '=== HTTPS 就绪 ==='
Write-Host "证书: .https\cert.pem   私钥: .https\key.pem   给手机的根CA: $phoneCA"
Write-Host ''
Write-Host '手机体验「安装到主屏幕」：'
Write-Host '  1) 手机与电脑连同一 Wi-Fi，先信任根 CA：'
Write-Host "     iOS：把 $phoneCA 发到手机 → 设置 → 通用 → VPN与设备管理 → 安装描述文件 →「关于本机-证书信任」开启完整信任"
Write-Host "     Android：把 $phoneCA 放手机 → 设置 → 安全 → 加密与凭据 → 安装证书(CA)"
Write-Host '  2) 放行端口（vite 默认 5173，换成实际端口）：'
Write-Host '     netsh advfirewall firewall add rule name="vite-https" dir=in action=allow protocol=TCP localport=5173'
if ($local) {
  Write-Host "  3) 启动：npm run dev 后，手机打开 https://$local`:5173"
} else {
  Write-Host '  3) 启动 npm run dev 后，手机打开 https://<本机局域网IP>:5173'
}
Write-Host ''
Write-Host '生产环境不需要这份本地证书：服务器上用 certbot / 托管面板签发正式 HTTPS 即可，manifest 与 SW 无需改动。'