# Canny en `/feedback`

La página **https://sunny-dolphin-b73804.netlify.app/feedback** usa el **widget oficial de Canny** (no iframe), tema oscuro, ruta `/feedback/*`.

## 1. En Canny (cuenta nueva)

1. Puedes **saltar Autopilot** por ahora (no es obligatorio para el portal).
2. **Settings → Company → Branding** → elige subdominio (ej. `explore` → portal `https://explore.canny.io`).
3. Crea un **Board** público (ej. "Feature requests").
4. Abre el board → **Install** (o **Share**) → copia el **Board token** (cadena larga).

## 2. Netlify — variables

En el sitio **sunny-dolphin-b73804** → **Environment variables**:

| Variable | Ejemplo |
|----------|---------|
| `VITE_CANNY_BOARD_TOKEN` | token del paso 4 |
| `VITE_CANNY_PORTAL_URL` | `https://explore.canny.io` |

Opcional: `VITE_FEEDBACK_URL` solo si prefieres iframe (UserJot u otra URL).

**Deploys → Trigger deploy** (obligatorio: `VITE_*` se embeben en el build).

## 3. Probar

- https://sunny-dolphin-b73804.netlify.app/feedback  
- Debe verse el board embebido (votar, crear posts).
- Enlace "Open in new tab" usa `VITE_CANNY_PORTAL_URL`.

## 4. Desde la waitlist

Tras registrarse en `/access`, el enlace **"Tell us what Explore should do"** lleva a `/feedback`.

## Problemas

| Síntoma | Solución |
|---------|----------|
| Sigue "Board coming soon" | Falta redeploy tras añadir `VITE_CANNY_BOARD_TOKEN` |
| Widget vacío | Token incorrecto; vuelve a copiar desde Install |
| Solo funciona en pestaña nueva | Pon `VITE_CANNY_PORTAL_URL` y usa el enlace inferior |
