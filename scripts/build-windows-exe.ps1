$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

$bun = Get-Command bun -ErrorAction SilentlyContinue
if (-not $bun) {
  $bun = Get-Command bun.exe -ErrorAction SilentlyContinue
}
if (-not $bun) {
  $bun = Get-Command bun.cmd -ErrorAction SilentlyContinue
}
if (-not $bun) {
  $bunInstall = $env:BUN_INSTALL
  if ($bunInstall) {
    $candidate = Join-Path $bunInstall "bin\bun.exe"
    if (Test-Path $candidate) {
      $bun = [PSCustomObject]@{ Source = $candidate }
    }
  }
}
if (-not $bun) {
  $userProfile = [Environment]::GetFolderPath("UserProfile")
  if ($userProfile) {
    $candidate = Join-Path $userProfile ".bun\bin\bun.exe"
    if (Test-Path $candidate) {
      $bun = [PSCustomObject]@{ Source = $candidate }
    }
  }
}
if (-not $bun) {
  throw "Bun not found. Please install Bun first and ensure it is in PATH."
}
$bunPath = $bun.Source
Write-Host "Using Bun: $bunPath"

$dist = Join-Path $root "dist"
if (-not (Test-Path $dist)) {
  New-Item -ItemType Directory -Path $dist | Out-Null
}

& $bunPath build .\src\entrypoints\windows\ClaudeExe.ts --compile --external:* --outfile .\dist\Claude.exe
if ($LASTEXITCODE -ne 0) { throw "Build failed for dist\\Claude.exe" }

& $bunPath build .\src\entrypoints\windows\claude_renameExe.ts --compile --external:* --outfile .\dist\claude_rename.exe
if ($LASTEXITCODE -ne 0) { throw "Build failed for dist\\claude_rename.exe" }

Write-Host "Built:"
Write-Host " - dist\Claude.exe"
Write-Host " - dist\claude_rename.exe"
