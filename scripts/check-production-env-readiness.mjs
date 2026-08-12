function configured(name, validator = (value) => Boolean(value)) {
  const value = String(process.env[name] || "").trim();
  const placeholder = /^(hidden|sensitive|encrypted|redacted|\[.+\])$/i.test(value);
  return Boolean(value) && !placeholder && validator(value);
}

const report = {
  supabase_url:
    configured("SUPABASE_URL", (value) => /^https:\/\//.test(value)) ||
    configured("VITE_SUPABASE_URL", (value) => /^https:\/\//.test(value)),
  supabase_secret_key: configured("SUPABASE_SECRET_KEY"),
  supabase_public_key:
    configured("SUPABASE_ANON_KEY") ||
    configured("SUPABASE_PUBLISHABLE_KEY") ||
    configured("VITE_SUPABASE_PUBLISHABLE_KEY"),
  admin_test_login:
    configured("BI_ADMIN_EMAIL", (value) => value.includes("@")) && configured("BI_ADMIN_PASSWORD"),
  pilot_test_login:
    configured("BI_PILOT_EMAIL", (value) => value.includes("@")) && configured("BI_PILOT_PASSWORD"),
  control_test_login:
    configured("BI_CONTROL_EMAIL", (value) => value.includes("@")) && configured("BI_CONTROL_PASSWORD"),
  analytics_cron_secret: configured("ANALYTICS_CRON_SECRET"),
  vercel_cron_secret: configured("CRON_SECRET"),
  cron_harness_generates_secret_at_deploy: true,
};

console.log(
  JSON.stringify(
    {
      ok:
        report.supabase_url &&
        report.supabase_secret_key &&
        report.supabase_public_key &&
        report.admin_test_login &&
        report.pilot_test_login &&
        report.control_test_login,
      configured: report,
      required_test_identities: ["admin_test_login", "pilot_test_login", "control_test_login"],
    },
    null,
    2,
  ),
);
