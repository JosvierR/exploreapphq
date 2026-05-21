# Admin waitlist — launch emails

Panel: **`/admin/waitlist`** (after sign-in at **`/team`**).

## One-time setup (Netlify + local)

### 1. Firebase service account

1. [Firebase Console](https://console.firebase.google.com/project/turismo-oculto/settings/serviceaccounts/adminsdk) → **Service accounts**
2. **Generate new private key** → downloads a `.json` file
3. In Netlify → **Environment variables** → add:

| Key | Value |
|-----|--------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Paste the **entire** JSON file on one line (Secret) |

Also add the same variable to your local `netlify.env` / `.env` for `npm run dev:all`.

### 2. Other variables (already required)

- `VITE_ADMIN_EMAILS` — your team email(s)
- `SMTP_*` — Resend (same as waitlist welcome)
- `VITE_FIREBASE_*` — web app config

Redeploy after adding the service account.

## How it works

| Step | What happens |
|------|----------------|
| User signs up on `/access` | Row in Firestore `waitlist/{email}` with `createdAt` |
| You open `/admin/waitlist` | Lists all emails from Firestore |
| **Preview** | Shows who would get the launch email (no `launchNotifiedAt`) |
| **Send launch emails** | Sends HTML email + sets `launchNotifiedAt` on each doc |

Only emails in `VITE_ADMIN_EMAILS` can call the API (Firebase ID token from `/team` login).

## Local dev

```bash
# .env must include FIREBASE_SERVICE_ACCOUNT_JSON=... (minified JSON)
npm run dev:all
```

Open http://localhost:5173/team → sign in → redirects to `/admin/waitlist`.
