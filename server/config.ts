export const config = {
  port: Number(process.env.PORT) || 3001,
  adminEmail: (process.env.ADMIN_EMAIL ?? "admin@example.com").toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD ?? "Admin",
  jwtSecret: process.env.JWT_SECRET ?? "explore-dev-secret-change-in-production",
  dbPath: process.env.DB_PATH ?? "./data/explore.db",
  smtp: {
    host: process.env.SMTP_HOST ?? "127.0.0.1",
    port: Number(process.env.SMTP_PORT) || 1025,
    secure: process.env.SMTP_SECURE === "true",
    from: process.env.SMTP_FROM ?? "Explore <noreply@exploreapphq.com>",
  },
  appUrl: process.env.APP_URL ?? "http://localhost:5173",
  siteUrl: process.env.SITE_URL ?? "https://exploreapphq.com",
  store: {
    apple:
      process.env.APP_STORE_URL ??
      "https://apps.apple.com/do/app/explore-tourism/id6748882805?l=en-GB",
    play:
      process.env.PLAY_STORE_URL ??
      "https://play.google.com/store/apps/details?id=com.explore.miapp&hl=es",
  },
};
