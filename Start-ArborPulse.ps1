$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error 'Install Node.js 22.13 or newer before running ArborPulse.'
}
node scripts/local.mjs start
