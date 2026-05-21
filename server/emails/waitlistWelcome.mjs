/** Shared welcome email HTML (used by API + Netlify Function). */

export function buildWaitlistWelcomeEmail(email, links) {
  const preheader = "You're on the list — we'll let you know when Explore is ready.";
  const header = `
          <tr>
            <td style="border-radius:20px 20px 0 0;overflow:hidden;background:linear-gradient(165deg,#0b0f14 0%,#071b2a 55%,#006dff 100%);padding:28px 32px 32px;text-align:center;">
              <img src="${links.logoUrl}" width="56" height="56" alt="Explore" style="border-radius:14px;display:block;margin:0 auto 16px;border:2px solid rgba(255,255,255,0.2);" />
              <p style="margin:0;font-size:26px;font-weight:800;letter-spacing:-0.03em;color:#ffffff;">Explore</p>
              <p style="margin:10px 0 0;font-size:14px;line-height:1.5;color:#b8c2cc;">Discover real places through videos</p>
            </td>
          </tr>`;
  const footer = `
          <tr>
            <td style="padding:20px 8px 8px;text-align:center;">
              <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#8a94a3;">
                Explore · <a href="${links.siteUrl}" style="color:#009bff;text-decoration:none;">exploreapphq.com</a>
              </p>
            </td>
          </tr>`;
  const body = `
          ${header}
          <tr>
            <td style="background:#ffffff;padding:36px 32px 32px;border-left:1px solid #e8edf3;border-right:1px solid #e8edf3;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#009bff;text-transform:uppercase;letter-spacing:0.06em;">You're in</p>
              <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;font-weight:800;color:#0b0f14;">Thanks for joining Explore</h1>
              <p style="margin:0 0 14px;font-size:16px;line-height:1.65;color:#3d4654;">
                We saved <strong>${email}</strong> on our early access list.
                Explore helps you discover real places through short videos, maps and routes.
              </p>
              <p style="margin:24px 0 0;font-size:15px;font-weight:600;color:#0b0f14;">— The Explore team</p>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;border-radius:0 0 20px 20px;border:1px solid #e8edf3;border-top:none;padding:0 32px 32px;">
              <p style="margin:0;font-size:13px;color:#8a94a3;text-align:center;">Watch · Save · Route · Explore</p>
            </td>
          </tr>
          ${footer}`;

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/></head><body style="margin:0;background:#eef2f7;font-family:Inter,system-ui,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2f7;padding:32px 16px;"><tr><td align="center">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;">${body}</table>
  </td></tr></table></body></html>`;

  const text = `Thanks for joining Explore!\n\nWe saved ${email} on our early access list.\n\n— The Explore team`;

  return {
    subject: "You're on the Explore list — we'll notify you when it's ready",
    html,
    text,
  };
}
