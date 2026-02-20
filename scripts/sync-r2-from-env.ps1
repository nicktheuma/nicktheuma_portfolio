$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $repoRoot '.env.local'

if (-not (Test-Path $envFile)) {
  Write-Error ".env.local not found at $envFile. Copy .env.example to .env.local and fill R2 values first."
}

$lines = Get-Content $envFile
foreach ($line in $lines) {
  $trimmed = $line.Trim()
  if ([string]::IsNullOrWhiteSpace($trimmed)) { continue }
  if ($trimmed.StartsWith('#')) { continue }
  $parts = $trimmed -split '=', 2
  if ($parts.Length -ne 2) { continue }
  $key = $parts[0].Trim()
  $value = $parts[1].Trim()
  [Environment]::SetEnvironmentVariable($key, $value, 'Process')
}

$required = 'R2_ACCOUNT_ID','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_BUCKET_NAME'
$missing = @()
foreach ($name in $required) {
  $value = (Get-Item -Path ("Env:" + $name) -ErrorAction SilentlyContinue).Value
  if ([string]::IsNullOrWhiteSpace($value)) {
    $missing += $name
  }
}

if ($missing.Count -gt 0) {
  Write-Error ("Missing required keys in .env.local: " + ($missing -join ', '))
}

Set-Location $repoRoot
npm run sync:r2