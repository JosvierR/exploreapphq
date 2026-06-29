# Generate vercel.env from netlify.env (same secrets, Vercel URL)
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root "netlify.env"
$dst = Join-Path $root "vercel.env"

if (-not (Test-Path $src)) {
  Write-Host "Missing netlify.env. Copy vercel.env.example to vercel.env instead."
  exit 1
}

$content = Get-Content $src -Raw -Encoding UTF8
$content = $content -replace "https://sunny-dolphin-b73804\.netlify\.app", "https://exploreapphq.vercel.app"
if ($content -notmatch "(?m)^ADMIN_PASSWORD=") {
  $content += "`r`nADMIN_PASSWORD=Admin`r`n"
}
Set-Content -Path $dst -Value $content.TrimEnd() -Encoding UTF8
Write-Host "Created vercel.env - import in Vercel Settings -> Environment Variables -> Import .env"
