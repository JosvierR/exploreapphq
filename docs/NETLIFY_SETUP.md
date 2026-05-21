# Configurar Explore en Netlify (producción)

Sitio de ejemplo: `https://sunny-dolphin-b73804.netlify.app`

## 1. Variables en Netlify (obligatorias para signup)

**Forma más fácil:** usa el archivo plantilla `netlify.env.example` → copia a `netlify.env` → rellena → **Import from .env** en Netlify.

Guía detallada: [NETLIFY_ENV_IMPORTAR.md](./NETLIFY_ENV_IMPORTAR.md)

**O manual:** Site settings → Environment variables → Add variables (scope **All**).

### Firebase (recomendado — guarda emails en Firestore)

Copia desde Firebase Console → Project settings → Your apps → Web app:

| Variable | Ejemplo |
|----------|---------|
| `VITE_FIREBASE_API_KEY` | `AIza...` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `tu-proyecto.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `tu-proyecto` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `tu-proyecto.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `123456789` |
| `VITE_FIREBASE_APP_ID` | `1:123:web:abc` |
| `VITE_ADMIN_EMAILS` | `tu@email.com` |

### Email de bienvenida (Netlify Function — Runtime)

Sin Railway, la función `waitlist-signup` envía el correo. Usa [Resend](https://resend.com) (gratis para empezar):

| Variable | Resend |
|----------|--------|
| `SMTP_HOST` | `smtp.resend.com` |
| `SMTP_PORT` | `465` |
| `SMTP_SECURE` | `true` |
| `SMTP_USER` | `resend` |
| `SMTP_PASS` | `re_xxxx` (API key) |
| `SMTP_FROM` | `Explore <onboarding@tudominio.com>` |
| `SITE_URL` | `https://exploreapphq.com` o tu URL Netlify |

### Firestore rules

En Firebase Console → Firestore → Rules, pega el archivo `firestore.rules` del repo y **Publish**.

### Admin `/team`

1. Firebase → Authentication → Email/Password → Enable  
2. Add user con tu email + contraseña  
3. Ese email debe estar en `VITE_ADMIN_EMAILS`  
4. Entra en `https://tu-sitio.netlify.app/team`

## 2. Redeploy

Después de guardar variables: **Deploys → Trigger deploy → Deploy site**.

Los `VITE_*` solo se aplican en **build** — hace falta un deploy nuevo.

## 3. Probar

1. `/access` → email → mensaje de éxito  
2. Revisa bandeja (o spam) — asunto: *You're on the Explore list*  
3. Firebase → Firestore → colección `waitlist`  
4. `/team` → login admin → landing completa  

## 4. Dominio custom

Netlify → Domain management → añade `exploreapphq.com` y actualiza `SITE_URL`.
