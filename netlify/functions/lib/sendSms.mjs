/**
 * SMS via Twilio REST API. Fully pluggable: if Twilio env vars are missing,
 * sending is skipped (no crash) and status reports why.
 *
 * Required env to actually send:
 *   TWILIO_ACCOUNT_SID   (starts with AC...)
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_FROM          (E.164 number, e.g. +18095551234) OR
 *   TWILIO_MESSAGING_SERVICE_SID (MG...) — preferred for A2P 10DLC
 */

export function getSmsStatus() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  const service = process.env.TWILIO_MESSAGING_SERVICE_SID;

  if (!sid || !token) {
    return {
      ready: false,
      reason: "Add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in Netlify to enable SMS.",
    };
  }
  if (!from && !service) {
    return {
      ready: false,
      reason: "Add TWILIO_FROM (a number) or TWILIO_MESSAGING_SERVICE_SID in Netlify.",
    };
  }
  return { ready: true, from: service ? `service:${service}` : from };
}

export function isSmsConfigured() {
  return getSmsStatus().ready;
}

/**
 * Send one SMS. Throws on failure; returns { sid } on success.
 * @param {{ to: string, body: string }} args
 */
export async function sendSms({ to, body }) {
  const status = getSmsStatus();
  if (!status.ready) {
    throw new Error(status.reason);
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  const service = process.env.TWILIO_MESSAGING_SERVICE_SID;

  const params = new URLSearchParams();
  params.set("To", to);
  params.set("Body", body);
  if (service) {
    params.set("MessagingServiceSid", service);
  } else {
    params.set("From", from);
  }

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const raw = data?.message || `Twilio rejected the SMS (${res.status}).`;
    if (res.status === 401 || raw === "Authenticate") {
      throw new Error(
        "Twilio auth failed. In Netlify, set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to the values in Twilio Console → Account → API keys & tokens, then redeploy.",
      );
    }
    if (raw.includes("not a valid phone number") || data?.code === 21211) {
      throw new Error("Invalid phone number format. Use country code, e.g. +18295551234.");
    }
    if (raw.includes("not verified") || data?.code === 21608) {
      throw new Error(
        "Twilio trial: verify this exact number under Phone Numbers → Verified Caller IDs, then try again.",
      );
    }
    if (data?.code === 21408 || raw.includes("region indicated by the 'To' number")) {
      throw new Error(
        "Twilio cannot SMS this country yet. In Twilio Console → Messaging → Geo permissions, enable Dominican Republic (+1 829/849), then try again.",
      );
    }
    throw new Error(raw);
  }
  return { sid: data.sid };
}
