export type EmailLinks = {
  siteUrl: string;
  appleUrl: string;
  playUrl: string;
  logoUrl: string;
};

function layout(content: string, preheader: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>Explore</title>
</head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2f7;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;">
          ${content}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function header(links: EmailLinks) {
  return `
          <tr>
            <td style="border-radius:20px 20px 0 0;overflow:hidden;background:linear-gradient(165deg,#0b0f14 0%,#071b2a 55%,#006dff 100%);padding:28px 32px 32px;text-align:center;">
              <img src="${links.logoUrl}" width="56" height="56" alt="Explore" style="border-radius:14px;display:block;margin:0 auto 16px;border:2px solid rgba(255,255,255,0.2);" />
              <p style="margin:0;font-size:26px;font-weight:800;letter-spacing:-0.03em;color:#ffffff;">Explore</p>
              <p style="margin:10px 0 0;font-size:14px;line-height:1.5;color:#b8c2cc;">Discover real places through videos</p>
            </td>
          </tr>`;
}

function footer(links: EmailLinks) {
  return `
          <tr>
            <td style="padding:20px 8px 8px;text-align:center;">
              <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#8a94a3;">
                Explore · <a href="${links.siteUrl}" style="color:#009bff;text-decoration:none;">exploreapphq.com</a>
              </p>
              <p style="margin:0;font-size:11px;color:#aab2bd;">You received this because you signed up on our website.</p>
            </td>
          </tr>`;
}

function ctaButtons(links: EmailLinks) {
  return `
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px auto 0;">
                <tr>
                  <td align="center" style="padding:0 6px 10px;">
                    <a href="${links.appleUrl}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:linear-gradient(145deg,#009bff,#006dff);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">Download on App Store</a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:0 6px;">
                    <a href="${links.playUrl}" style="display:inline-block;padding:12px 24px;border-radius:999px;border:2px solid #009bff;color:#006dff;font-size:14px;font-weight:700;text-decoration:none;">Get it on Google Play</a>
                  </td>
                </tr>
              </table>`;
}

export { buildWaitlistWelcomeEmail } from "./waitlistWelcome.mjs";

export function buildAppLaunchEmail(email: string, links: EmailLinks) {
  const preheader = "Explore is ready — download the app and start discovering places.";
  const body = `
          ${header(links)}
          <tr>
            <td style="background:#ffffff;padding:36px 32px 24px;border-left:1px solid #e8edf3;border-right:1px solid #e8edf3;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#009bff;text-transform:uppercase;letter-spacing:0.06em;">It's here</p>
              <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;font-weight:800;color:#0b0f14;letter-spacing:-0.02em;">Explore is ready for you</h1>
              <p style="margin:0 0 14px;font-size:16px;line-height:1.65;color:#3d4654;">
                Hi — you asked us to let you know when the app was ready. That moment is now.
              </p>
              <p style="margin:0 0 14px;font-size:16px;line-height:1.65;color:#3d4654;">
                Open Explore, watch real videos from real places, save your favorites and build routes you can follow today.
              </p>
              <p style="margin:0;font-size:14px;color:#8a94a3;">Registered as <strong style="color:#5c6570;">${email}</strong></p>
              ${ctaButtons(links)}
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;border-radius:0 0 20px 20px;border:1px solid #e8edf3;border-top:none;padding:8px 32px 32px;">
              <p style="margin:0;font-size:14px;line-height:1.6;color:#5c6570;text-align:center;">
                Questions? Write us at josvierrod@exploreapphq.com
              </p>
            </td>
          </tr>
          ${footer(links)}`;

  const html = layout(body, preheader);
  const text = [
    "Explore is ready!",
    "",
    "Download the app:",
    `App Store: ${links.appleUrl}`,
    `Google Play: ${links.playUrl}`,
    "",
    `Registered as: ${email}`,
    "",
    "— The Explore team",
  ].join("\n");

  return {
    subject: "Explore is ready — download the app",
    html,
    text,
  };
}
