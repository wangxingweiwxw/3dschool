$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$serverUrl = 'http://127.0.0.1:5173/'
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodePath = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
if (-not (Test-Path -LiteralPath $nodePath)) { throw 'Node.js is required. Install it from https://nodejs.org/ and try again.' }
$vitePath = Join-Path $projectRoot 'node_modules\vite\bin\vite.js'
if (-not (Test-Path -LiteralPath $vitePath)) { throw 'Dependencies are missing. Run npm install in the project directory first.' }
try { $existing = Invoke-WebRequest -Uri $serverUrl -TimeoutSec 2 -UseBasicParsing } catch { $existing = $null }
if ($existing) {
  if ($existing.Content -notmatch 'A LITTLE ADVENTURE') { throw 'Port 5173 is already used by another application.' }
} else {
  $logDirectory = Join-Path $projectRoot 'artifacts'
  New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
  $serverProcess = Start-Process -FilePath $nodePath -ArgumentList @(('"' + $vitePath + '"'), '--host', '127.0.0.1', '--port', '5173', '--strictPort') -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDirectory 'server.log') -RedirectStandardError (Join-Path $logDirectory 'server-error.log')
  $ready = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Milliseconds 300
    if ($serverProcess.HasExited) { throw 'The local server stopped. See artifacts/server-error.log.' }
    try { $response = Invoke-WebRequest -Uri $serverUrl -TimeoutSec 1 -UseBasicParsing; if ($response.StatusCode -eq 200) { $ready = $true; break } } catch { }
  }
  if (-not $ready) { throw 'The server did not become ready. See artifacts/server.log.' }
  Write-Output ('Server process: ' + $serverProcess.Id)
}
Start-Process $serverUrl
Write-Output ('Fudan Garden Adventure is ready: ' + $serverUrl)
