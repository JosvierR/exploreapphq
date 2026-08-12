import { createClient } from "@supabase/supabase-js";

export function createBusinessServiceClient() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, "");
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) {
    throw new Error("SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SECRET_KEY are required.");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function argValue(name) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((item) => item.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
}

export function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

export function parseDay(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) throw new Error(`${label} must use YYYY-MM-DD.`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} is not a valid calendar day.`);
  }
  return value;
}

export function daysInclusive(from, to) {
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  if (end < start) throw new Error("--to must be on or after --from.");
  const days = [];
  for (let cursor = start; cursor <= end; cursor += 86_400_000) {
    days.push(new Date(cursor).toISOString().slice(0, 10));
  }
  return days;
}

export function nextDay(day) {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + 86_400_000).toISOString().slice(0, 10);
}

export function safeError(error) {
  return {
    code: String(error?.code || "business_operation_failed"),
    message: String(error?.message || error || "Business operation failed").slice(0, 500),
  };
}

export async function exactCount(query) {
  const { count, error } = await query;
  if (error) throw error;
  return Number(count || 0);
}

