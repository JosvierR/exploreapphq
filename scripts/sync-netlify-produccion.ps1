# Sincroniza netlify.env -> Netlify (requiere: npx netlify-cli login una vez)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root "netlify.env"

if (-not (Test-Path $envFile)) {
  Write-Host "No existe netlify.env. Ejecuta: npm run netlify:env" -ForegroundColor Red
  exit 1
}

Write-Host "Comprobando dominio en Resend..." -ForegroundColor Cyan
node (Join-Path $root "scripts\check-resend-domain.mjs")
if ($LASTEXITCODE -eq 2) {
  Write-Host ""
  Write-Host "AVISO: exploreapphq.com aun no esta Verified en Resend." -ForegroundColor Yellow
  Write-Host "Anade los DNS (Google/Netlify) antes de enviar launch emails." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Importando variables a Netlify (site sunny-dolphin-b73804)..." -ForegroundColor Cyan
Set-Location $root
npx --yes netlify-cli link --name sunny-dolphin-b73804 2>$null
npx --yes netlify-cli env:import $envFile --replaceExisting

Write-Host ""
Write-Host "Despliegue en produccion..." -ForegroundColor Cyan
npx --yes netlify-cli deploy --prod --build

Write-Host "Listo. Prueba: https://exploreapphq.com/admin/waitlist" -ForegroundColor Green
