import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;
let loggedDiagnostics = false;

function supabaseUrl() {
  return import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
}

function supabasePublishableKey() {
  return (
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ||
    ""
  );
}

export function isSupabaseBrowserConfigured() {
  return Boolean(supabaseUrl() && supabasePublishableKey());
}

function logSupabaseDiagnostics() {
  if (!import.meta.env.DEV || loggedDiagnostics) return;
  loggedDiagnostics = true;

  console.info("[supabase-admin] url", supabaseUrl() || "(missing)");
  console.info("[supabase-admin] publishable key configured", Boolean(supabasePublishableKey()));
}

export function getSupabaseBrowserClient() {
  logSupabaseDiagnostics();

  if (!isSupabaseBrowserConfigured()) {
    throw new Error("Supabase browser config is missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.");
  }

  if (!browserClient) {
    browserClient = createClient(supabaseUrl(), supabasePublishableKey(), {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    });
  }

  return browserClient;
}
