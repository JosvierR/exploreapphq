# Importar `netlify.env` en Netlify

## Antes de importar

1. Abre `netlify.env` en el proyecto (Notepad).
2. Sustituye **`PEGA_TU_AUTH_TOKEN_DE_TWILIO_AQUI`** por tu Auth Token de Twilio (ojo en la consola).
3. Si rotaste Resend/Firebase, actualiza `SMTP_PASS` y `FIREBASE_SERVICE_ACCOUNT_JSON` también.

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
| `TWILIO_FROM` | `+15717712087` |

Prueba: `/access` → SMS + email.
