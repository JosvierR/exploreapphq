# Importar `netlify.env` en Netlify

## Antes de importar

1. Abre `netlify.env` en el proyecto (Notepad).
2. Confirma **`TWILIO_ACCOUNT_SID`** termina en `fda**8**c3d0dd919bc8a7` (no `fda0` — un typo común).
3. Si rotaste Resend/Firebase/Twilio, actualiza `SMTP_PASS`, `TWILIO_AUTH_TOKEN` y `FIREBASE_SERVICE_ACCOUNT_JSON`.

## Twilio (SMS a RD +1829)

En [Twilio Console → Messaging → Geo permissions](https://console.twilio.com/us1/develop/sms/settings/geo-permissions), activa **Dominican Republic** (+1 829 / 849). Sin eso verás error 21408.

En cuenta **trial**, el número destino debe estar en **Verified Caller IDs**.

## En Netlify

1. https://app.netlify.com → sitio **sunny-dolphin-b73804**
2. **Site configuration** → **Environment variables**
3. **Add a variable** → **Import from a .env file** (o el botón de import en la lista)
4. Pega **todo** el contenido de `netlify.env`
5. Marca **Contains secret values**
6. **Scopes:** All scopes
7. **Deploy contexts:** All deploy contexts
8. Si pregunta por conflictos: **Update existing variable values** (para corregir `SMTP_FROM`)
9. **Import variables**

## Después

**Deploys** → **Trigger deploy** → **Deploy site** → espera **Published**

## Comprobar

| Variable | Valor esperado |
|----------|----------------|
| `SMTP_FROM` | `Explore <onboarding@exploreapphq.com>` |
| `SITE_URL` | `https://sunny-dolphin-b73804.netlify.app` |
| `TWILIO_ACCOUNT_SID` | `AC704e0ea7b1ec44fda**8**c3d0dd919bc8a7` (ojo: `fda8`, no `fda0`) |
| `TWILIO_FROM` | `+15717712087` |

Prueba: `/access` → SMS + email.
