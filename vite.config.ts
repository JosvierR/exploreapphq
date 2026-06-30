import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const siteUrl = (env.VITE_SITE_URL || "https://exploreapphq.vercel.app").replace(/\/$/, "");

  return {
  plugins: [
    react(),
    {
      name: "html-site-url",
      transformIndexHtml(html) {
        return html.replace(/https:\/\/exploreapphq\.com\/?/g, `${siteUrl}/`);
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: mode !== "production",
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
};
});
