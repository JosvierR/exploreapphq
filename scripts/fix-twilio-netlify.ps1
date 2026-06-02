# Corrige TWILIO_* en Netlify (requiere: npx netlify-cli login)
# Uso: .\scripts\fix-twilio-netlify.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root "netlify.env"

if (-not (Test-Path $envFile)) {
  Write-Error "No existe netlify.env en $root"
}

$vars = @{}
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
  $i = $_.IndexOf('=')
  $k = $_.Substring(0, $i).Trim()
  $v = $_.Substring($i + 1).Trim()
  if ($k -match '^TWILIO_') { $vars[$k] = $v }
}

if ($vars.Count -lt 3) {
  Write-Error "netlify.env debe tener TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM"
}

# Site UUID (netlify sites:list) — no requiere netlify link
$site = "f2d952d2-7ea7-48f6-9fe1-2d490e71cdc0"
$cli = "netlify-cli@26.1.0"

Write-Host "Sitio: sunny-dolphin-b73804 ($site)"
$sid = $vars['TWILIO_ACCOUNT_SID']
if ($sid -notmatch 'fda8c3d') {
  Write-Warning "TWILIO_ACCOUNT_SID debe contener fda8c3d (no fda0). Revisa netlify.env"
}
Write-Host "SID (ultimos 8): ...$($sid.Substring($sid.Length - 8))"

foreach ($key in @("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM")) {
  Write-Host "Setting $key ..."
  npx $cli env:set $key $vars[$key] --site $site --force | Out-Host
}

Write-Host ""
Write-Host "Redeploy (elige una):"
Write-Host "  npx $cli deploy --prod --build --site $site"
Write-Host "  o Netlify UI -> Deploys -> Trigger deploy"
Write-Host ""
Write-Host "Luego borra welcomeSmsAt en Firestore y prueba /access"
