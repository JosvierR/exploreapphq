# Producción: emails con Resend (obligatorio)

En Netlify **no** hay Mailpit. Los correos salen por **Resend**. Si en Resend ves **"No domains yet"**, los envíos a Gmail de tu waitlist **fallan** aunque el panel diga "Sent".

## Checklist (15–30 min)

### 1. Dominio en Resend

1. [https://resend.com/domains](https://resend.com/domains) → **Add domain**
2. Dominio: **`exploreapphq.com`** (o subdominio `updates.exploreapphq.com`)
3. Copia los registros DNS (SPF, DKIM, etc.) en tu proveedor DNS (Netlify DNS, Cloudflare, etc.)
4. Espera estado **Verified** en Resend

### 2. Variables en Netlify

**Site configuration** → **Environment variables** (scope: **All** — Build + Functions):

| Variable | Valor |
|----------|--------|
| `SMTP_PASS` | API key `re_...` (Secret) |
| `SMTP_FROM` | `Explore <onboarding@exploreapphq.com>` |
| `SITE_URL` | `https://sunny-dolphin-b73804.netlify.app` (o tu dominio) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | JSON completo de Firebase (Secret) |
| `VITE_FIREBASE_*` | Igual que en local |

**No uses** `onboarding@resend.dev` en producción: solo entrega al email de tu cuenta Resend (`josvierp@gmail.com`), no a la waitlist.

### 3. Redeploy

**Deploys** → **Trigger deploy** → **Deploy site**

### 4. Probar

1. `/access` — registro con un Gmail de prueba → debe llegar welcome (con dominio verificado)
2. `/admin/waitlist` — banner verde de "Production email ready" (sin banner rojo)
3. **Preview recipients** → **Send launch emails**
4. Revisa bandeja y [Resend → Logs](https://resend.com/emails)

## Panel admin

- Si falta dominio: banner **Production email not ready** y el botón de envío deshabilitado
- Errores de Resend aparecen en rojo (no en verde)
- `launchNotifiedAt` en Firestore solo se marca si el envío fue **exitoso**

## Si un contacto quedó "Sent" sin recibir el correo

En Firebase Console → Firestore → `waitlist` → documento del email → borra el campo `launchNotifiedAt` → vuelve a enviar desde el panel.

## Seguridad

Si pegaste la API key o el JSON de service account en un chat, **rótalos** en Resend y Firebase.
