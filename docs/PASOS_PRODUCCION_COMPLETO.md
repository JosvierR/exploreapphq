# Producción Explore — paso a paso (sin cancelar el dominio)

Sigue los pasos **en orden**. Marca cada casilla al terminar.

**Sitio Netlify:** `sunny-dolphin-b73804`  
**URL web (ahora):** https://sunny-dolphin-b73804.netlify.app  
**Dominio marca:** `exploreapphq.com` (correo + DNS en Google)  
**Firebase:** proyecto `turismo-oculto`

El código ya está en GitHub; cada push a `main` despliega solo.

---

## Fase 0 — Código (ya hecho si lees esto tras el último deploy)

- [ ] En Netlify → **Deploys** → el último deploy es **Published** (commit reciente en `main`)
- [ ] Si no: espera 2–3 min o **Trigger deploy**

---

## Fase 1 — Resend (emails a Gmail)

Sin esto, la waitlist guarda datos pero **no llegan correos** a usuarios normales.

### 1.1 Añadir dominio en Resend

1. Entra a https://resend.com/domains  
2. **Add domain** → `exploreapphq.com`  
   - Alternativa más simple: `updates.exploreapphq.com` (subdominio; mismos pasos DNS en Google)

### 1.2 DNS en Google (Workspace / dominio)

1. https://admin.google.com → **Cuenta** → **Dominios** → **Administrar dominios**  
2. `exploreapphq.com` → **DNS** (o enlace al registrador)  
3. Crea **cada** registro que muestra Resend (copiar con el botón Copy):

| Tipo | Host / Nombre | Notas |
|------|----------------|--------|
| TXT | `resend._domainkey` | DKIM — pegar valor **completo** |
| MX | `send` | Priority `10` |
| TXT | `send` | SPF |
| TXT | `_dmarc` | Opcional: `v=DMARC1; p=none;` |

**No borres** los MX de Gmail del dominio raíz (`@`) si usas correo `@exploreapphq.com` en Workspace.

### 1.3 Verificar

1. Resend → dominio → **I've added the records**  
2. Espera estado **Verified** (15 min – 48 h)

### 1.4 Casilla

- [ ] Resend muestra **Verified** en `exploreapphq.com` (o tu subdominio)

---

## Fase 2 — Variables en Netlify

### 2.1 Importar o editar

1. https://app.netlify.com → sitio **sunny-dolphin-b73804**  
2. **Site configuration** → **Environment variables**  
3. **Import from .env** → archivo `netlify.env` del proyecto (en tu PC), **o** edita a mano:

| Variable | Valor correcto |
|----------|----------------|
| `SITE_URL` | `https://sunny-dolphin-b73804.netlify.app` |
| `VITE_SITE_URL` | igual que `SITE_URL` |
| `SMTP_PASS` | API key Resend `re_...` (**Secret**) |
| `SMTP_FROM` | `Explore <onboarding@exploreapphq.com>` *(mismo dominio verificado en Resend)* |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | JSON completo Firebase (**Secret**) |
| `VITE_FIREBASE_*` | Igual que en `netlify.env` |
| `VITE_ADMIN_EMAILS` | `josvierrod@exploreapphq.com` |

Scope: **All** (Build + Functions).

### 2.2 Redeploy obligatorio

1. **Deploys** → **Trigger deploy** → **Deploy site**  
2. Espera **Published**

### 2.3 Casilla

- [ ] Variables guardadas + deploy **Published**

---

## Fase 3 — Firebase (login admin)

1. https://console.firebase.google.com/project/turismo-oculto/authentication/settings  
2. **Authorized domains** → **Add domain**  
3. Añade: `sunny-dolphin-b73804.netlify.app`  
4. (Opcional) `exploreapphq.com` cuando la web use ese dominio

### Casilla

- [ ] Dominio Netlify en authorized domains

---

## Fase 4 — Pruebas en producción

### 4.1 Waitlist + email bienvenida

1. Abre https://sunny-dolphin-b73804.netlify.app/access  
2. Registra un **Gmail de prueba**  
3. Revisa bandeja (y spam)  
4. Resend → **Logs** → debe aparecer **Delivered**

- [ ] Email de bienvenida recibido

### 4.2 Panel admin

1. https://sunny-dolphin-b73804.netlify.app/team  
2. Login: `josvierrod@exploreapphq.com` (contraseña en `SETUP_CREDENTIALS.local.md`)  
3. https://sunny-dolphin-b73804.netlify.app/admin/waitlist  

- [ ] Lista de registros visible  
- [ ] **No** hay banner rojo “Production email not ready”  
- [ ] **Preview recipients** muestra pendientes  
- [ ] **Send launch emails** → mensaje verde + correo en Gmail  

### 4.3 Si algo falla

| Síntoma | Qué revisar |
|---------|----------------|
| Banner rojo en admin | Resend no Verified o `SMTP_FROM` con `@resend.dev` |
| 502 en /access | Netlify → **Functions** → log `waitlist-signup` |
| No login en /team | Firebase authorized domain + `VITE_FIREBASE_*` |
| Sent 0 / Failed | Netlify log `admin-notify-launch` + Resend Logs |

---

## Fase 5 — (Opcional) Web en `exploreapphq.com`

Solo cuando quieras la URL bonita. El dominio está en **otro team Netlify** hasta que lo liberes.

1. En Netlify, revisa **todos los teams** → busca sitio con `exploreapphq.com` → **Remove domain**  
2. O soporte Netlify: liberar `exploreapphq.com`  
3. Sitio `sunny-dolphin-b73804` → **Add domain** → externo o Netlify DNS  
4. DNS en Google: A `75.2.60.5`, `99.83.190.102` o CNAME según indique Netlify  
5. Cambia `SITE_URL` y `VITE_SITE_URL` a `https://exploreapphq.com` → redeploy  
6. Firebase authorized domains → añade `exploreapphq.com`

---

## Comandos locales (opcional)

```powershell
cd C:\Users\Josvier\Desktop\exploreapphq-1
npm run build
npm run resend:check
npx netlify-cli login
npm run netlify:sync
```

---

## Seguridad

- No subas `netlify.env` a Git.  
- Si la API key o el JSON de Firebase se compartieron en un chat, **rótalos** en Resend y Firebase.

---

## Resumen de URLs de producción (hoy)

| Qué | URL |
|-----|-----|
| Landing | https://sunny-dolphin-b73804.netlify.app |
| Waitlist | https://sunny-dolphin-b73804.netlify.app/access |
| Admin login | https://sunny-dolphin-b73804.netlify.app/team |
| Waitlist panel | https://sunny-dolphin-b73804.netlify.app/admin/waitlist |

Cuando Fase 5 esté lista, sustituye por `https://exploreapphq.com`.
