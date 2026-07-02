# Directiva — cuentas admin web

Panel: **https://www.exploreapphq.com/admin**

## Cuentas (6)

| Slot | Email |
| --- | --- |
| 01 | `directiva.ops.01@exploreapphq.com` |
| 02 | `directiva.ops.02@exploreapphq.com` |
| 03 | `directiva.ops.03@exploreapphq.com` |
| 04 | `directiva.ops.04@exploreapphq.com` |
| 05 | `directiva.ops.05@exploreapphq.com` |
| 06 | `directiva.ops.06@exploreapphq.com` |

Contraseñas: ver `SETUP_CREDENTIALS.local.md` (local, no commitear).

## Crear o rotar cuentas (producción)

### 1. Deploy del endpoint bootstrap

El código expone:

`POST /api/admin/system/bootstrap-board`

Protegido por header `X-Admin-Bootstrap-Secret` = `ADMIN_BOOTSTRAP_SECRET` (solo en Vercel).

### 2. Configurar secreto en Vercel

Vercel → Project → Settings → Environment Variables → **Production**:

```env
ADMIN_BOOTSTRAP_SECRET=<secreto-largo-aleatorio>
```

Redeploy.

### 3. Ejecutar bootstrap

```powershell
$env:ADMIN_BOOTSTRAP_SECRET="<secreto-largo-aleatorio>"
npm run admin:bootstrap
```

Esto crea/actualiza las 6 cuentas en Supabase Auth, las inserta en `admin_users`, y escribe `SETUP_CREDENTIALS.local.md`.

### 4. Post-bootstrap

1. Copia las contraseñas a un gestor seguro.
2. Añade en Vercel Production:

```env
EXPLORE_ADMIN_ALLOWED_EMAILS=directiva.ops.01@exploreapphq.com,directiva.ops.02@exploreapphq.com,directiva.ops.03@exploreapphq.com,directiva.ops.04@exploreapphq.com,directiva.ops.05@exploreapphq.com,directiva.ops.06@exploreapphq.com
```

3. **Elimina** `ADMIN_BOOTSTRAP_SECRET` y redeploy.

## Alternativa local

Si tienes `SUPABASE_SECRET_KEY` válida en `.env` o `vercel.env`:

```bash
npm run admin:provision
```

## Verificación

1. Abre https://www.exploreapphq.com/admin
2. Login con `directiva.ops.01@exploreapphq.com` + contraseña
3. Debe cargar el dashboard sin error 403
4. `GET /api/admin/me` debe devolver `role: admin`
