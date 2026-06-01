/** Generic premium email template for the onboarding / win-back sequence. */

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ctaButton(links, label) {
  const href = links.appleUrl || links.playUrl || links.siteUrl;
  if (!href) return "";
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:28px auto 0;">
      <tr><td align="center">
        <a href="${esc(href)}" style="display:inline-block;padding:15px 30px;border-radius:999px;background:linear-gradient(145deg,#009bff,#006dff);color:#ffffff;font-size:15px;font-weight:800;text-decoration:none;box-shadow:0 10px 28px rgba(0,109,255,0.35);">${esc(label)}</a>
      </td></tr>
    </table>`;
}

function bullets(items) {
  return items
    .map(
      (it) => `
      <tr>
        <td valign="top" style="padding:6px 10px 6px 0;font-size:18px;line-height:1.4;">${esc(it.icon)}</td>
        <td style="padding:6px 0;font-size:15px;line-height:1.6;color:#3d4654;"><strong style="color:#0b0f14;">${esc(it.title)}</strong> — ${esc(it.body)}</td>
      </tr>`,
    )
    .join("");
}

/**
 * @param {{ eyebrow:string, title:string, intro:string, items?:{icon,title,body}[], outro?:string, cta?:string, preheader:string }} step
 * @param {{ siteUrl:string, appleUrl:string, playUrl:string, logoUrl:string }} links
 */
export function buildSequenceEmail(step, links) {
  const content = `
    <tr>
      <td style="padding:0;border-radius:24px 24px 0 0;overflow:hidden;background:linear-gradient(165deg,#0b0f14 0%,#071b2a 50%,#0047b3 86%,#006dff 100%);">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr><td style="padding:34px 32px 26px;text-align:center;">
            <img src="${esc(links.logoUrl)}" width="56" height="56" alt="Explore" style="border-radius:16px;display:block;margin:0 auto 16px;border:2px solid rgba(255,255,255,0.25);" />
            <div style="display:inline-block;padding:6px 14px;border-radius:999px;background:rgba(0,155,255,0.2);border:1px solid rgba(90,200,250,0.45);">
              <span style="font-size:11px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#5ac8fa;">${esc(step.eyebrow)}</span>
            </div>
          </td></tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="background:#ffffff;padding:36px 36px 8px;border-left:1px solid #e8edf3;border-right:1px solid #e8edf3;">
        <h1 style="margin:0 0 14px;font-size:25px;line-height:1.25;font-weight:800;color:#0b0f14;letter-spacing:-0.03em;">${esc(step.title)}</h1>
        <p style="margin:0 0 18px;font-size:16px;line-height:1.65;color:#3d4654;">${esc(step.intro)}</p>
      </td>
    </tr>
    ${
      step.items && step.items.length
        ? `<tr><td style="background:#ffffff;padding:0 36px 8px;border-left:1px solid #e8edf3;border-right:1px solid #e8edf3;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${bullets(step.items)}</table>
          </td></tr>`
        : ""
    }
    <tr>
      <td style="background:#ffffff;padding:8px 36px 34px;border-left:1px solid #e8edf3;border-right:1px solid #e8edf3;">
        ${step.outro ? `<p style="margin:14px 0 0;font-size:15px;line-height:1.65;color:#3d4654;">${esc(step.outro)}</p>` : ""}
        ${step.cta ? ctaButton(links, step.cta) : ""}
        <p style="margin:30px 0 0;font-size:15px;font-weight:600;color:#0b0f14;">— The Explore team</p>
      </td>
    </tr>
    <tr>
      <td style="background:#ffffff;border-radius:0 0 24px 24px;border:1px solid #e8edf3;border-top:none;padding:8px 36px 30px;text-align:center;">
        <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:0.12em;color:#8a94a3;">WATCH · SAVE · ROUTE · EXPLORE</p>
      </td>
    </tr>
    <tr>
      <td style="padding:22px 12px 8px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#8a94a3;"><a href="${esc(links.siteUrl)}" style="color:#009bff;text-decoration:none;font-weight:600;">${esc(displayHost(links.siteUrl))}</a></p>
        <p style="margin:6px 0 0;font-size:11px;color:#aab2bd;">You're receiving this because you joined the Explore early access list.</p>
      </td>
    </tr>`;

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><meta name="color-scheme" content="light"/><title>${esc(step.title)}</title></head>
<body style="margin:0;padding:0;background:#e4ebf3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(step.preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(180deg,#dce6f2 0%,#eef2f7 100%);padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;box-shadow:0 24px 64px rgba(11,15,20,0.12);border-radius:24px;">${content}</table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    step.title,
    "",
    step.intro,
    "",
    ...(step.items || []).map((it) => `· ${it.title}: ${it.body}`),
    step.outro ? `\n${step.outro}` : "",
    "",
    "— The Explore team",
    links.siteUrl,
  ]
    .filter((l) => l !== undefined)
    .join("\n");

  return { subject: step.subject, html, text };
}

function displayHost(siteUrl) {
  try {
    return new URL(siteUrl).hostname.replace(/^www\./, "");
  } catch {
    return siteUrl;
  }
}
