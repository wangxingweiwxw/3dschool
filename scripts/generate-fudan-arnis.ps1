param(
  [string]$WorldName = "fudan-handan",
  [string]$Bbox = "31.296,121.497,31.304,121.510",
  [double]$Scale = 1.0,
  [switch]$Overture
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$toolsRoot = Join-Path $projectRoot ".tools"
$arnisRoot = Join-Path $toolsRoot "arnis"
$worldDir = Join-Path (Join-Path $env:APPDATA ".minecraft\saves") $WorldName

Write-Host "=== Arnis · 复旦大学邯郸校区 ===" -ForegroundColor Cyan
Write-Host "范围: $Bbox"
Write-Host "输出: $worldDir"

if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
  Write-Host "未找到 Rust/Cargo。请先安装: https://rustup.rs/" -ForegroundColor Yellow
  exit 1
}

if (-not (Test-Path (Join-Path $arnisRoot ".git"))) {
  New-Item -ItemType Directory -Force -Path $toolsRoot | Out-Null
  Write-Host "首次运行：获取 Arnis 源码..." -ForegroundColor Yellow
  git clone https://github.com/louis-e/arnis.git $arnisRoot
}

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $worldDir) | Out-Null
if (Test-Path (Join-Path $worldDir "level.dat")) {
  Write-Host "目标存档已存在：$worldDir" -ForegroundColor Yellow
  $answer = Read-Host "继续生成可能覆盖已有区块，输入 YES 继续"
  if ($answer -cne "YES") { Write-Host "已取消。"; exit 0 }
}

$args = @(
  "run", "--release", "--no-default-features", "--",
  "--output-dir=$worldDir",
  "--bbox=$Bbox",
  "--mode=geo-terrain",
  "--scale=$Scale",
  "--spawn-lat=31.299",
  "--spawn-lng=121.502",
  "--overture=$($Overture.IsPresent.ToString().ToLowerInvariant())"
)

Push-Location $arnisRoot
try {
  Write-Host "开始生成。首次编译可能需要几分钟..." -ForegroundColor Green
  & cargo @args
  if ($LASTEXITCODE -ne 0) { throw "Arnis 生成失败，退出码 $LASTEXITCODE" }
} finally {
  Pop-Location
}

Write-Host "生成完成：$worldDir" -ForegroundColor Green
Write-Host "在 Minecraft Java 单人游戏中打开存档：$WorldName"
