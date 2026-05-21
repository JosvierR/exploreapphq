/** Shared welcome email HTML (used by API + Netlify Function). */

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function storeButtons(links) {
  if (!links.appleUrl && !links.playUrl) return "";
  const apple = links.appleUrl
    ? `<td align="center" style="padding:6px;">
        <a href="${esc(links.appleUrl)}" style="display:inline-block;padding:14px 26px;border-radius:999px;background:linear-gradient(145deg,#009bff,#006dff);color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;box-shadow:0 8px 24px rgba(0,109,255,0.35);">App Store</a>
      </td>`
    : "";
  const play = links.playUrl
    ? `<td align="center" style="padding:6px;">
        <a href="${esc(links.playUrl)}" style="display:inline-block;padding:12px 22px;border-radius:999px;border:2px solid #009bff;color:#006dff;font-size:14px;font-weight:700;text-decoration:none;background:#ffffff;">Google Play</a>
      </td>`
    : "";
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:28px auto 0;">
      <tr>${apple}${play}</tr>
    </table>`;
}

/**
 * @param {string} email
 * @param {{ siteUrl: string; appleUrl: string; playUrl: string; logoUrl: string }} links
 */
export function buildWaitlistWelcomeEmail(email, links) {
  const safeEmail = esc(email);
  const heroImg = `${links.siteUrl.replace(/\/$/, "")}/ExplorePromo1.png`;
  const preheader =
    "You're on the list — real places, videos & routes. We'll email you when Explore is ready.";

  const content = `
          <tr>
            <td style="padding:0;border-radius:24px 24px 0 0;overflow:hidden;background:linear-gradient(165deg,#0b0f14 0%,#071b2a 42%,#0047b3 78%,#006dff 100%);">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding:36px 32px 28px;text-align:center;">
                    <div style="display:inline-block;padding:6px 14px;border-radius:999px;background:rgba(0,155,255,0.2);border:1px solid rgba(90,200,250,0.45);margin-bottom:20px;">
                      <span style="font-size:11px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#5ac8fa;">Early access confirmed</span>
                    </div>
                    <img src="${esc(links.logoUrl)}" width="64" height="64" alt="Explore" style="border-radius:18px;display:block;margin:0 auto 18px;border:2px solid rgba(255,255,255,0.25);box-shadow:0 12px 40px rgba(0,0,0,0.35);" />
                    <p style="margin:0;font-size:32px;font-weight:800;letter-spacing:-0.04em;color:#ffffff;line-height:1.1;">Explore</p>
                    <p style="margin:12px auto 0;max-width:320px;font-size:15px;line-height:1.55;color:#b8c2cc;">Discover real places through videos — then save them, route them, and go.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 24px 28px;">
                    <img src="${esc(heroImg)}" width="512" alt="Explore app preview" style="display:block;width:100%;max-width:512px;height:auto;margin:0 auto;border-radius:16px;border:1px solid rgba(255,255,255,0.12);box-shadow:0 20px 50px rgba(0,0,0,0.4);" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:40px 36px 12px;border-left:1px solid #e8edf3;border-right:1px solid #e8edf3;">
              <h1 style="margin:0 0 12px;font-size:28px;line-height:1.2;font-weight:800;color:#0b0f14;letter-spacing:-0.03em;">You're on the list 🎉</h1>
              <p style="margin:0 0 20px;font-size:17px;line-height:1.65;color:#3d4654;">Hi — thanks for raising your hand. You're among the first people who'll get Explore when we open the doors.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 28px;background:linear-gradient(135deg,#f0f7ff 0%,#e8f4ff 100%);border:1px solid #c5e3ff;border-radius:16px;">
                <tr>
                  <td style="padding:18px 22px;text-align:center;">
                    <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#006dff;text-transform:uppercase;letter-spacing:0.08em;">Saved for you</p>
                    <p style="margin:0;font-size:16px;font-weight:700;color:#0b0f14;word-break:break-all;">${safeEmail}</p>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.65;color:#3d4654;">Here's what you'll be able to do on day one:</p>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:0 28px 32px;border-left:1px solid #e8edf3;border-right:1px solid #e8edf3;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="33%" valign="top" style="padding:8px;">
                    <table role="presentation" width="100%" style="background:#f7f9fc;border:1px solid #e8edf3;border-radius:14px;">
                      <tr><td style="padding:18px 14px;text-align:center;">
                        <p style="margin:0 0 8px;font-size:22px;line-height:1;">🎬</p>
                        <p style="margin:0;font-size:13px;font-weight:800;color:#0b0f14;">Watch</p>
                        <p style="margin:8px 0 0;font-size:12px;line-height:1.5;color:#5c6570;">Real videos from real places</p>
                      </td></tr>
                    </table>
                  </td>
                  <td width="33%" valign="top" style="padding:8px;">
                    <table role="presentation" width="100%" style="background:#f7f9fc;border:1px solid #e8edf3;border-radius:14px;">
                      <tr><td style="padding:18px 14px;text-align:center;">
                        <p style="margin:0 0 8px;font-size:22px;line-height:1;">📍</p>
                        <p style="margin:0;font-size:13px;font-weight:800;color:#0b0f14;">Save</p>
                        <p style="margin:8px 0 0;font-size:12px;line-height:1.5;color:#5c6570;">Spots you actually want to visit</p>
                      </td></tr>
                    </table>
                  </td>
                  <td width="33%" valign="top" style="padding:8px;">
                    <table role="presentation" width="100%" style="background:#f7f9fc;border:1px solid #e8edf3;border-radius:14px;">
                      <tr><td style="padding:18px 14px;text-align:center;">
                        <p style="margin:0 0 8px;font-size:22px;line-height:1;">🗺️</p>
                        <p style="margin:0;font-size:13px;font-weight:800;color:#0b0f14;">Route</p>
                        <p style="margin:8px 0 0;font-size:12px;line-height:1.5;color:#5c6570;">Build trips that flow</p>
                      </td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:0 36px 36px;border-left:1px solid #e8edf3;border-right:1px solid #e8edf3;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b0f14;border-radius:16px;overflow:hidden;">
                <tr>
                  <td style="padding:24px 26px;">
                    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#5ac8fa;text-transform:uppercase;letter-spacing:0.06em;">What happens next</p>
                    <p style="margin:0;font-size:15px;line-height:1.65;color:#e8edf3;">We're polishing the last details. When Explore is ready to download, you'll get <strong style="color:#ffffff;">one more email</strong> from us with your link — no spam, no noise.</p>
                  </td>
                </tr>
              </table>
              ${storeButtons(links)}
              <p style="margin:32px 0 0;font-size:15px;line-height:1.6;color:#3d4654;">Can't wait? Follow us for sneak peeks and places worth exploring.</p>
              <p style="margin:14px 0 0;text-align:center;">
                <a href="https://www.instagram.com/explore.app.latam" style="color:#009bff;font-size:14px;font-weight:600;text-decoration:none;margin:0 10px;">Instagram</a>
                <span style="color:#d0d5dc;">·</span>
                <a href="https://www.tiktok.com/@explore.app" style="color:#009bff;font-size:14px;font-weight:600;text-decoration:none;margin:0 10px;">TikTok</a>
              </p>
              <p style="margin:28px 0 0;font-size:15px;font-weight:600;color:#0b0f14;">— The Explore team</p>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;border-radius:0 0 24px 24px;border:1px solid #e8edf3;border-top:none;padding:8px 36px 32px;text-align:center;">
              <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:0.12em;color:#8a94a3;">WATCH · SAVE · ROUTE · EXPLORE</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 12px 8px;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;color:#8a94a3;">
                <a href="${esc(links.siteUrl)}" style="color:#009bff;text-decoration:none;font-weight:600;">exploreapphq.com</a>
              </p>
              <p style="margin:0;font-size:11px;color:#aab2bd;">You received this because you joined the Explore early access list.</p>
            </td>
          </tr>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>Explore — You're on the list</title>
</head>
<body style="margin:0;padding:0;background:#e4ebf3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(180deg,#dce6f2 0%,#e8eef5 50%,#eef2f7 100%);padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;box-shadow:0 24px 64px rgba(11,15,20,0.12);border-radius:24px;">
          ${content}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    "You're on the Explore early access list!",
    "",
    `We saved: ${email}`,
    "",
    "What you'll do with Explore:",
    "· Watch real videos from real places",
    "· Save spots you want to visit",
    "· Build routes and explore nearby",
    "",
    "What's next: When the app is ready, we'll send one more email with download links. No spam.",
    "",
    links.appleUrl ? `App Store: ${links.appleUrl}` : "",
    links.playUrl ? `Google Play: ${links.playUrl}` : "",
    "",
    "Instagram: https://www.instagram.com/explore.app.latam",
    "TikTok: https://www.tiktok.com/@explore.app",
    "",
    "— The Explore team",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject: "You're in — Explore early access is confirmed",
    html,
    text,
  };
}
