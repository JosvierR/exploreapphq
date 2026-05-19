import fs from "fs";
import path from "path";
import { config } from "./config.js";

export type WaitlistRow = {
  id: number;
  email: string;
  created_at: string;
  launch_notified_at: string | null;
};

type WaitlistFile = { nextId: number; rows: WaitlistRow[] };

const filePath = path.join(path.dirname(config.dbPath), "waitlist.json");

function ensureDir() {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function load(): WaitlistFile {
  ensureDir();
  if (!fs.existsSync(filePath)) {
    return { nextId: 1, rows: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as WaitlistFile;
  } catch {
    return { nextId: 1, rows: [] };
  }
}

function save(data: WaitlistFile) {
  ensureDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

export function addToWaitlist(email: string): { created: boolean } {
  const data = load();
  const existing = data.rows.find((r) => r.email === email);
  if (existing) return { created: false };

  data.rows.push({
    id: data.nextId++,
    email,
    created_at: new Date().toISOString(),
    launch_notified_at: null,
  });
  save(data);
  return { created: true };
}

export function getWaitlistStats() {
  const data = load();
  const total = data.rows.length;
  const pendingLaunch = data.rows.filter((r) => !r.launch_notified_at).length;
  return { total, pendingLaunch, notified: total - pendingLaunch };
}

export function listWaitlist(limit = 100, offset = 0): WaitlistRow[] {
  const data = load();
  return [...data.rows]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(offset, offset + limit);
}

export function listWaitlistPendingLaunch(): WaitlistRow[] {
  return load()
    .rows.filter((r) => !r.launch_notified_at)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function markLaunchNotified(email: string) {
  const data = load();
  const row = data.rows.find((r) => r.email === email);
  if (row) row.launch_notified_at = new Date().toISOString();
  save(data);
}
