# Cómo pasar las variables a Netlify (muy fácil)

## Paso 1 — Crear tu archivo `netlify.env`

En la carpeta del proyecto (`exploreapphq-1`):

**Windows (PowerShell):**

```powershell
cd C:\Users\Josvier\Desktop\exploreapphq-1
copy netlify.env.example netlify.env
notepad netlify.env
```

Rellena cada `PEGA_AQUI` con tus datos reales.

---

## Paso 2 — Importar en Netlify (interfaz web)

1. Entra a [https://app.netlify.com](https://app.netlify.com)
2. Abre tu sitio (ej. `sunny-dolphin-b73804`)
3. **Site configuration** → **Environment variables**
4. Botón **Import from a .env file** (o **Add** → **Import**)
5. Sube o pega el contenido de **`netlify.env`**
6. Confirma que aparezcan todas las variables
7. Para cada una, scope: **All scopes** (Build + Functions)

---

## Paso 3 — Redeploy

**Deploys** → **Trigger deploy** → **Deploy site**

Sin redeploy, las variables `VITE_*` **no** entran en la web.

---

## Paso 4 — Probar

- https://TU-SITIO.netlify.app/access → email → éxito
- https://TU-SITIO.netlify.app/team → login admin (Firebase Auth)

---

## Alternativa: Netlify CLI

```powershell
npm install -g netlify-cli
netlify login
netlify link
netlify env:import netlify.env
```

Luego redeploy en el panel.

---

## Dónde sacar cada valor

| Variable | Dónde |
|----------|--------|
| `VITE_FIREBASE_*` | Firebase Console → ⚙️ → Project settings → Your apps |
| `VITE_ADMIN_EMAILS` | Tu email de admin |
| `SMTP_*` | [resend.com](https://resend.com) → API Keys |
| `SITE_URL` | URL de Netlify o `exploreapphq.com` |

---

## Importante

- **Nunca** hagas commit de `netlify.env` (tiene contraseñas).
- El archivo `netlify.env.example` sí puede ir en Git (solo plantilla).
