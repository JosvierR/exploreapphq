# Waitlist Pro — teléfono, SMS, secuencias y feedback

Implementa las recomendaciones de crecimiento: pedir **teléfono** (SMS abre 85% vs 15% email),
**secuencia de mensajes** pre-lanzamiento y un **feedback board**.

---

## 1. Teléfono como principal (ya activo)

`/access` ahora pide **teléfono** (obligatorio) y **email** (opcional).

- Se guarda en Firestore `waitlist/{telefonoDigits}` con campos:
  `phone`, `email`, `createdAt`, `source`, `consentSms`, `seqStep`.
- Datos antiguos (keyed por email) siguen visibles en el panel.
- El panel `/admin/waitlist` muestra columnas **Phone**, **Email**, **Sequence**.

No requiere configuración extra. Funciona ya.

---

## 2. SMS con Twilio (opcional, dejar listo)

El código está completo y es **pluggable**: si faltan las variables, no envía y no rompe nada.

### Crear la cuenta (cuando puedas)

1. [twilio.com](https://www.twilio.com) → crea cuenta.
2. **EE.UU.:** registra A2P 10DLC (Brand + Campaign) — tarda días, es obligatorio para enviar a números de EE.UU.
3. Crea un **Messaging Service** (recomendado) o compra un número.

### Variables en Netlify

| Variable | Valor |
|----------|--------|
| `TWILIO_ACCOUNT_SID` | `AC...` |
| `TWILIO_AUTH_TOKEN` | (Secret) |
| `TWILIO_MESSAGING_SERVICE_SID` | `MG...` (recomendado) |
| `TWILIO_FROM` | número `+1...` (si no usas Messaging Service) |

Trigger deploy. El panel mostrará **SMS: Ready** y los textos de bienvenida + secuencia empezarán a salir.

Cumplimiento: el formulario ya incluye consentimiento y “Reply STOP to opt out”.

---

## 3. Secuencia de mensajes (email + SMS)

Definida en `netlify/functions/lib/sequences.mjs`:

| Día | Mensaje |
|-----|---------|
| 0 | Welcome (al registrarse) |
| 1 | Qué hace Explore diferente |
| 3 | 3 formas de usar Explore |
| 7 | Win-back / sigues en la lista |
| 14 | Para creadores |
| 28 | Lanzamiento cerca |

- Una **función programada** (`sequence-tick.mjs`, `@daily`) revisa cada contacto y envía el
  siguiente paso cuando le toca, avanzando `seqStep` en Firestore.
- Envía **email** (si hay email + Resend) y **SMS** (si hay teléfono + Twilio).
- Requiere `FIREBASE_SERVICE_ACCOUNT_JSON` para leer/escribir contactos.

Para editar el copy o los tiempos, ajusta `sequences.mjs` y redeploy.

---

## 4. Feedback board (Canny)

Página pública en **`/feedback`**. Guía completa: [CANNY_FEEDBACK.md](./CANNY_FEEDBACK.md).

1. Crea board en [Canny](https://canny.io) → copia **Board token** (Install).
2. Netlify → **`VITE_CANNY_BOARD_TOKEN`** + **`VITE_CANNY_PORTAL_URL`** (ej. `https://explore.canny.io`).
3. Trigger deploy.

La pantalla de éxito de `/access` enlaza a `/feedback`.

---

## Resumen de variables nuevas

```env
VITE_FEEDBACK_URL=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM=
TWILIO_MESSAGING_SERVICE_SID=
```

Todo es opcional excepto teléfono (ya activo). Email/Resend sigue igual que antes.
