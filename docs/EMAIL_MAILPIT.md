# Emails: Mailpit (local) vs Resend (producción)

## Mailpit — pruebas en tu PC

Mailpit **no envía a Gmail real**. Captura todo en una bandeja web.

```powershell
npm run dev:mail          # Docker: Mailpit en :8025
npm run dev:all             # web + API local
```

En `.env` (local):

```env
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_FROM=Explore <noreply@exploreapphq.com>
```

Abre **http://localhost:8025** y prueba:

- Registro en http://localhost:5173/access
- Launch desde http://localhost:5173/admin/waitlist (usa API local → Mailpit)

```powershell
npm run email:test
npm run email:launch:test
npm run email:launch:test tu@email.com
```

## Resend — sitio en Netlify (usuarios reales)

Netlify **no puede** usar Mailpit. Ahí va **Resend** (`SMTP_PASS=re_...`).

1. Verifica **exploreapphq.com** en [resend.com/domains](https://resend.com/domains)
2. En Netlify:

```env
SMTP_FROM=Explore <onboarding@exploreapphq.com>
SMTP_PASS=re_tu_api_key
```

3. Redeploy

Con `onboarding@resend.dev` solo llega al email de tu cuenta Resend — por eso ves **Failed 3** a otros destinatarios.

## Resumen

| Entorno | Herramienta | ¿Llega a Gmail? |
|---------|-------------|-----------------|
| Local | Mailpit | No (solo localhost:8025) |
| Netlify | Resend + dominio | Sí |
