/** Launch notification email (API + Netlify admin function). */

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function storeButtons(links) {
  const apple = links.appleUrl
    ? `<td align="center" style="padding:8px;">
        <a href="${esc(links.appleUrl)}" style="display:inline-block;padding:16px 32px;border-radius:999px;background:linear-gradient(145deg,#009bff,#006dff);color:#ffffff;font-size:16px;font-weight:800;text-decoration:none;box-shadow:0 10px 28px rgba(0,109,255,0.4);">Download on App Store</a>
      </td>`
    : "";
  const play = links.playUrl
    ? `<td align="center" style="padding:8px;">
        <a href="${esc(links.playUrl)}" style="display:inline-block;padding:14px 28px;border-radius:999px;border:2px solid #009bff;color:#006dff;font-size:15px;font-weight:700;text-decoration:none;background:#fff;">Get it on Google Play</a>
      </td>`
    : "";
  if (!apple && !play) return "";
  return `<table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:32px auto 0;"><tr>${apple}${play}</tr></table>`;
}

export function buildAppLaunchEmail(email, links) {
  const safeEmail = esc(email);
  const heroImg = `${links.siteUrl.replace(/\/$/, "")}/ExplorePromo1.png`;
  const preheader = "Explore is ready — download now and start discovering real places.";

  const content = `
    <tr>
      <td style="padding:0;border-radius:24px 24px 0 0;overflow:hidden;background:linear-gradient(165deg,#0b0f14 0%,#006dff 70%,#009bff 100%);">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding:40px 32px 24px;text-align:center;">
              <p style="margin:0 0 16px;font-size:12px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#5ac8fa;">It's live</p>
              <p style="margin:0;font-size:36px;font-weight:800;letter-spacing:-0.04em;color:#ffffff;line-height:1.1;">Explore is ready</p>
              <p style="margin:14px auto 0;max-width:340px;font-size:16px;line-height:1.55;color:#e8edf3;">The wait is over. Download the app and discover places through real videos.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 32px;">
              <img src="${esc(heroImg)}" width="512" alt="Explore app" style="display:block;width:100%;max-width:512px;height:auto;margin:0 auto;border-radius:16px;border:1px solid rgba(255,255,255,0.15);box-shadow:0 24px 56px rgba(0,0,0,0.35);" />
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="background:#ffffff;padding:40px 36px;border-left:1px solid #e8edf3;border-right:1px solid #e8edf3;">
        <h1 style="margin:0 0 16px;font-size:26px;font-weight:800;color:#0b0f14;letter-spacing:-0.03em;">Your early access is open</h1>
        <p style="margin:0 0 20px;font-size:17px;line-height:1.65;color:#3d4654;">Hi — you joined our list as <strong style="color:#0b0f14;">${safeEmail}</strong>. Explore is ready for you to download, watch, save spots and build routes.</p>
        ${storeButtons(links)}
        <p style="margin:28px 0 0;font-size:15px;line-height:1.6;color:#5c6570;text-align:center;">Watch · Save · Route · Explore</p>
      </td>
    </tr>
    <tr>
      <td style="background:#ffffff;border-radius:0 0 24px 24px;border:1px solid #e8edf3;border-top:none;padding:8px 36px 28px;text-align:center;">
        <p style="margin:0;font-size:14px;color:#8a94a3;">Questions? Reply or write us at <a href="mailto:josvierrod@exploreapphq.com" style="color:#009bff;text-decoration:none;">josvierrod@exploreapphq.com</a></p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 12px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#8a94a3;"><a href="${esc(links.siteUrl)}" style="color:#009bff;font-weight:600;text-decoration:none;">exploreapphq.com</a></p>
      </td>
    </tr>`;

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/></head>
<body style="margin:0;background:#e4ebf3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;">${esc(preheader)}</div>
  <table role="presentation" width="100%" style="background:#e8eef5;padding:40px 16px;"><tr><td align="center">
  <table role="presentation" style="max-width:600px;width:100%;box-shadow:0 24px 64px rgba(11,15,20,0.12);border-radius:24px;">${content}</table>
  </td></tr></table>
</body></html>`;

  const text = [
    "Explore is ready to download!",
    "",
    `Hi — you registered as ${email}.`,
    "",
    links.appleUrl ? `App Store: ${links.appleUrl}` : "",
    links.playUrl ? `Google Play: ${links.playUrl}` : "",
    "",
    "— The Explore team",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject: "Explore is ready — download the app now",
    html,
    text,
  };
}
