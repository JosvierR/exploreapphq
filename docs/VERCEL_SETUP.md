# Configurar Explore en Vercel

## 1. Importar proyecto

1. [vercel.com/new](https://vercel.com/new) → Import **JosvierR/exploreapphq**
2. Framework: **Vite** (auto)
3. Root: `./` — Build: `npm run build` — Output: `dist` (ya en `vercel.json`)

## 2. Variables de entorno (obligatorio)

Copia `vercel.env.example` → `vercel.env`, rellena con los mismos valores de tu `netlify.env`.

En Vercel → **Settings → Environment Variables → Import .env** → pega `vercel.env`.

Marca **Sensitive** en: `SMTP_PASS`, `TWILIO_AUTH_TOKEN`, `FIREBASE_SERVICE_ACCOUNT_JSON`.

| Variable | Notas |
|----------|--------|
| `SITE_URL` / `VITE_SITE_URL` | Tras deploy: `https://exploreapphq.vercel.app` o tu dominio |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Una línea JSON (Firebase → Service accounts) |
| `SMTP_FROM` | `Explore <onboarding@exploreapphq.com>` (dominio verificado en Resend) |
| `VITE_*` | Necesarias en **Production** y **Preview** (build del cliente) |

## 3. Deploy

Click **Deploy**. Las APIs viven en `/api/*` (waitlist, feedback, admin).

## 4. Firebase Auth

Firebase Console → Authentication → Settings → **Authorized domains** → añade:

- `exploreapphq.vercel.app`
- Tu dominio custom si lo conectas

## 5. Web Analytics

1. Vercel → proyecto → **Analytics** → **Enable Web Analytics**
2. El repo ya incluye `@vercel/analytics` (`src/features/analytics/VercelAnalytics.tsx`)
3. Redeploy → navega entre `/`, `/access`, `/feedback` → datos en ~30 s

## 6. Probar

| Ruta | Qué |
|------|-----|
| `/access` | Waitlist (teléfono + email) |
| `/feedback` | Ideas / feedback |
| `/team` | Admin: `admin@example.com` / `Admin` |
| `/admin/waitlist` | Panel + broadcast |

## 7. Dominio custom (exploreapphq.com)

Vercel → **Domains** → Add → sigue DNS. Luego actualiza `SITE_URL` y `VITE_SITE_URL` y **Redeploy**.

## APIs (Vercel Serverless)

| Ruta | Función |
|------|---------|
| `POST /api/waitlist/signup` | Registro waitlist + SMS/email |
| `POST /api/feedback/submit` | Feedback → Firestore |
| `GET /api/admin/waitlist` | Lista admin |
| `POST /api/admin/waitlist/notify-launch` | Email de lanzamiento |
| `POST /api/admin/broadcast` | SMS + email masivo |

La lógica está en `netlify/functions/` (reutilizada vía `api/`).
