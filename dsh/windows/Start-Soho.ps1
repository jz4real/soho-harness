param(
  [string]$RepositoryRoot = (Join-Path $PSScriptRoot '..\..'),
  [switch]$SkipMaxKB
)

$ErrorActionPreference = 'Stop'

function Require-Command([string]$Name, [string]$Help) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is required. $Help"
  }
}

function Test-LoopbackPortAvailable([int]$Port) {
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
  try {
    $listener.Start()
    return $true
  } catch {
    return $false
  } finally {
    $listener.Stop()
  }
}

$repo = (Resolve-Path $RepositoryRoot).Path
$appData = if ($env:LOCALAPPDATA) { $env:LOCALAPPDATA } else { Join-Path $HOME 'AppData\Local' }
$sohoHome = Join-Path $appData 'SohoHarness'
$configPath = Join-Path $sohoHome 'config.json'
$exampleConfig = Join-Path $repo 'dsh\config\soho.example.json'

New-Item -ItemType Directory -Force -Path $sohoHome | Out-Null
if (-not (Test-Path $configPath)) {
  Copy-Item $exampleConfig $configPath
  Write-Host "Created local settings: $configPath"
}

try {
  $config = Get-Content -Raw $configPath | ConvertFrom-Json
} catch {
  throw "Cannot read local Soho settings at $configPath. Restore valid JSON from $exampleConfig."
}

$dshPort = if ($config.dshWebPort) { [int]$config.dshWebPort } else { 3080 }
$maxkbPort = if ($config.maxkbPort) { [int]$config.maxkbPort } else { 8080 }
$startMaxKB = if ($null -eq $config.startMaxKB) { $true } else { [bool]$config.startMaxKB }
$env:MAXKB_PORT = [string]$maxkbPort

Require-Command node 'Install Node.js 22 LTS, then reopen this window.'
Require-Command pnpm 'Install pnpm 11 (`corepack enable`; `corepack prepare pnpm@11.7.0 --activate`), then reopen this window.'

if (-not (Test-LoopbackPortAvailable $dshPort)) {
  throw "DSH port $dshPort is already in use. Stop the existing DSH process or change dshWebPort in $configPath."
}

if ($startMaxKB -and -not $SkipMaxKB) {
  Require-Command docker 'Install Docker Desktop and switch it to Linux containers, then reopen this window.'
  if (Test-LoopbackPortAvailable $maxkbPort) {
    & docker compose -f (Join-Path $repo 'dsh\maxkb\docker-compose.yml') up -d
    if ($LASTEXITCODE -ne 0) { throw 'MaxKB could not start. Check Docker Desktop and the container registry connection.' }
  } else {
    Write-Host "Port $maxkbPort is already in use; using the existing local service."
  }
}

if (-not (Test-Path (Join-Path $repo 'node_modules'))) {
  Write-Host 'Installing DSH dependencies for this Windows computer. This only happens on the first launch.'
  & pnpm --dir $repo install --frozen-lockfile
  if ($LASTEXITCODE -ne 0) { throw 'DSH dependency installation failed.' }
}

$env:DSH_HOME = Join-Path $sohoHome 'dsh'
$env:DSH_WEB_PORT = [string]$dshPort
$env:MAXKB_BASE_URL = "http://127.0.0.1:$maxkbPort"

& node (Join-Path $repo 'dsh\setup-soho-web.mjs')
if ($LASTEXITCODE -ne 0) { throw 'DSH profile setup failed.' }

$profileDir = Join-Path $env:DSH_HOME 'profiles\web'
& pnpm --dir $profileDir install --offline
if ($LASTEXITCODE -ne 0) { throw 'DSH local profile installation failed.' }

$node = (Get-Command node).Source
$process = Start-Process -FilePath $node -WorkingDirectory $repo -ArgumentList @('dsh/start-soho-web.mjs') -PassThru
Start-Sleep -Seconds 2
Start-Process "http://127.0.0.1:$dshPort"
Wait-Process -Id $process.Id
exit $process.ExitCode
