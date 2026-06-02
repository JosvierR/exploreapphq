# Corrige TWILIO_* en Netlify (requiere: netlify login una vez)
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

$site = "sunny-dolphin-b73804"
Write-Host "Sitio: $site"
Write-Host "SID (ultimos 8): ...$($vars['TWILIO_ACCOUNT_SID'].Substring($vars['TWILIO_ACCOUNT_SID'].Length - 8))"

foreach ($key in @("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM")) {
  Write-Host "Setting $key ..."
  npx --yes netlify-cli@latest env:set $key $vars[$key] --site $site --context production --force
}

Write-Host ""
Write-Host "Listo. Ahora en Netlify: Deploys -> Trigger deploy -> Deploy site"
Write-Host "Luego borra welcomeSmsAt en Firestore y prueba /access"
