# Usar `exploreapphq.com` (en vez de sunny-dolphin-b73804.netlify.app)

## 1. Netlify — añadir dominio

1. https://app.netlify.com → sitio **sunny-dolphin-b73804**
2. **Domain management** → **Add a domain** → `exploreapphq.com`
3. Si dice *“managed by another team”*: entra al **otro team** de Netlify, quita el dominio de ese sitio, y vuelve a añadirlo aquí.
4. Netlify te muestra los registros DNS exactos. **Primary domain:** `exploreapphq.com`

## 2. Squarespace DNS (corrige el CNAME de `www`)

En tu captura, `www` apunta a **`exploreapphq.netlify.app`** — eso es **incorrecto**.

| Host | Tipo | Valor correcto |
|------|------|----------------|
| `www` | CNAME | `sunny-dolphin-b73804.netlify.app` |
| `@` (raíz) | A o ALIAS | Lo indica Netlify al añadir el dominio (4 IPs `75.2.60.x` o “Netlify Load Balancer”) |

**No borres** los MX de Google Workspace ni los TXT de Resend (`resend._domainkey`, `_dmarc`, etc.).

Guarda DNS y espera 5–30 min (a veces hasta 24 h).

## 3. Variables en Netlify

Tras editar `netlify.env` local:

```env
SITE_URL=https://exploreapphq.com
VITE_SITE_URL=https://exploreapphq.com
```

Importa en Netlify o ejecuta:

```powershell
npx netlify-cli env:set SITE_URL https://exploreapphq.com --force
npx netlify-cli env:set VITE_SITE_URL https://exploreapphq.com --force
npx netlify-cli deploy --prod --build
```

## 4. Firebase

[Authentication → Settings → Authorized domains](https://console.firebase.google.com/project/turismo-oculto/authentication/settings)

Añade: `exploreapphq.com` y `www.exploreapphq.com`

## 5. Comprobar

| URL | Debe abrir |
|-----|------------|
| https://exploreapphq.com | Landing |
| https://exploreapphq.com/access | Waitlist |
| https://exploreapphq.com/team | Admin login |

El subdominio `sunny-dolphin-b73804.netlify.app` seguirá funcionando; Netlify puede redirigir al dominio principal cuando esté activo.
