# Crea netlify.env desde la plantilla si no existe
$root = Split-Path -Parent $PSScriptRoot
$example = Join-Path $root "netlify.env.example"
$target = Join-Path $root "netlify.env"

if (Test-Path $target) {
  Write-Host "Ya existe netlify.env - abrelo y editarlo:" -ForegroundColor Yellow
  Write-Host $target
  notepad $target
  exit 0
}

Copy-Item $example $target
Write-Host "Creado: netlify.env" -ForegroundColor Green
Write-Host "1. Rellena PEGA_AQUI en el bloc de notas"
Write-Host "2. Netlify -> Environment variables -> Import from .env -> netlify.env"
Write-Host "3. Trigger deploy"
notepad $target
