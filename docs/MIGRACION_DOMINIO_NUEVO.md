# Migrar a un dominio nuevo (sin romper waitlist ni admin)

Usa esta lista cuando compres el dominio nuevo. **No canceles** `exploreapphq.com` hasta que todo abajo esté en verde.

Reemplaza `TU-DOMINIO-NUEVO.com` por el dominio real (ej. `getexplore.com`).

---

## Fase 1 — Dominio nuevo (antes de cancelar el viejo)

### 1. Comprar y DNS

- Registra el dominio (Google Domains, Cloudflare, Namecheap, etc.).
- **No** canceles Workspace ni el dominio viejo todavía.

### 2. Netlify (`sunny-dolphin-b73804`)

1. **Domain management** → **Add domain** → `TU-DOMINIO-NUEVO.com`
2. Configura DNS (Netlify DNS o registros en tu registrador)
3. Espera dominio **Active** + HTTPS

### 3. Resend

1. [resend.com/domains](https://resend.com/domains) → **Add domain** → `TU-DOMINIO-NUEVO.com`
2. Pega los TXT/MX en el DNS del **dominio nuevo**
3. Espera **Verified**

### 4. Variables (`netlify.env` → importar en Netlify)

```env
SITE_URL=https://TU-DOMINIO-NUEVO.com
SMTP_FROM=Explore <onboarding@TU-DOMINIO-NUEVO.com>
```

Mantén el resto (`VITE_FIREBASE_*`, `SMTP_PASS`, `FIREBASE_SERVICE_ACCOUNT_JSON`) igual.

**Trigger deploy** en Netlify.

### 5. Firebase

[Console](https://console.firebase.google.com/project/turismo-oculto) → **Authentication** → **Settings** → **Authorized domains** → añade `TU-DOMINIO-NUEVO.com`.

Si el admin usará email en el dominio nuevo, actualiza también:

- `VITE_ADMIN_EMAILS` en Netlify
- `firestore.rules` → email del admin → despliega reglas: `firebase deploy --only firestore:rules`

### 6. Código (opcional, cuando tengas el nombre)

Busca y sustituye en el repo:

- `src/lib/constants.ts` — `url` y `email` de contacto
- `index.html` — `og:url`
- Plantillas en `server/emails/` si mencionan el dominio viejo

O deja solo `SITE_URL` / `SMTP_FROM`: los enlaces en emails ya salen de `SITE_URL` en runtime.

### 7. Probar

| Prueba | URL |
|--------|-----|
| Landing | `https://TU-DOMINIO-NUEVO.com` |
| Waitlist | `https://TU-DOMINIO-NUEVO.com/access` |
| Admin login | `https://TU-DOMINIO-NUEVO.com/team` |
| Panel | `https://TU-DOMINIO-NUEVO.com/admin/waitlist` |
| Resend logs | [resend.com/emails](https://resend.com/emails) |

---

## Fase 2 — Solo cuando lo nuevo funcione

1. Avisa a usuarios de la waitlist si cambia la URL pública (opcional).
2. En el dominio viejo puedes poner un redirect a la URL nueva (si aún lo controlas).
3. **Entonces** cancela lo que ya no necesites (Workspace del dominio viejo, etc.).

---

## Qué no se pierde al cancelar el dominio viejo

| Se conserva | Notas |
|-------------|--------|
| Waitlist en Firestore | Mismo proyecto `turismo-oculto` |
| Código en GitHub / Netlify | Mismo sitio, nuevo dominio |
| API keys Resend / Firebase | Solo cambia dominio en Resend + `SITE_URL` |

| Se pierde si cancelas el viejo sin migrar |
|-------------------------------------------|
| Correo `@exploreapphq.com` en Workspace |
| Enlaces guardados al dominio antiguo |
| Dominio en otro team Netlify (deja de importar si lo liberan) |

---

## Dominio bloqueado en Netlify

El error del dominio viejo en otro team **desaparece** si no usas ese dominio en el sitio nuevo. El dominio **nuevo** no debería tener ese conflicto.

---

## Comandos útiles

```powershell
# Tras editar netlify.env (cuando tengas login Netlify CLI)
npm run netlify:sync

# Reglas Firestore tras cambiar admin email
firebase deploy --only firestore:rules
```
