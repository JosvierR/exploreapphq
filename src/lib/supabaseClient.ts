import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;
let loggedDiagnostics = false;

export function getSupabaseBrowserUrl() {
  return import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
}

export function getSupabaseBrowserPublishableKey() {
  return (
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ||
    ""
  );
}

export function isSupabaseBrowserConfigured() {
  return Boolean(getSupabaseBrowserUrl() && getSupabaseBrowserPublishableKey());
}

function logSupabaseDiagnostics() {
  if (!import.meta.env.DEV || loggedDiagnostics) return;
  loggedDiagnostics = true;

  console.info("[supabase-admin] url", getSupabaseBrowserUrl() || "(missing)");
  console.info("[supabase-admin] publishable key configured", Boolean(getSupabaseBrowserPublishableKey()));
}

export function getSupabaseBrowserClient() {
  logSupabaseDiagnostics();

  if (!isSupabaseBrowserConfigured()) {
    throw new Error("Supabase browser config is missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.");
  }

  if (!browserClient) {
    browserClient = createClient(getSupabaseBrowserUrl(), getSupabaseBrowserPublishableKey(), {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    });
  }

  return browserClient;
}
