import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { config } from "./config.js";

const dir = path.dirname(config.dbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

export const db = new Database(config.dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS waitlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    launch_notified_at TEXT
  );
`);

const columns = db.prepare("PRAGMA table_info(waitlist)").all() as { name: string }[];
if (!columns.some((c) => c.name === "launch_notified_at")) {
  db.exec(`ALTER TABLE waitlist ADD COLUMN launch_notified_at TEXT`);
}

export type WaitlistRow = {
  id: number;
  email: string;
  created_at: string;
  launch_notified_at: string | null;
};

export function addToWaitlist(email: string): { created: boolean } {
  const existing = db.prepare("SELECT id FROM waitlist WHERE email = ?").get(email);
  if (existing) return { created: false };
  db.prepare("INSERT INTO waitlist (email) VALUES (?)").run(email);
  return { created: true };
}

export function getWaitlistStats() {
  const total = (db.prepare("SELECT COUNT(*) AS n FROM waitlist").get() as { n: number }).n;
  const pendingLaunch = (
    db.prepare("SELECT COUNT(*) AS n FROM waitlist WHERE launch_notified_at IS NULL").get() as {
      n: number;
    }
  ).n;
  const notified = total - pendingLaunch;
  return { total, pendingLaunch, notified };
}

export function listWaitlist(limit = 100, offset = 0): WaitlistRow[] {
  return db
    .prepare(
      `SELECT id, email, created_at, launch_notified_at
       FROM waitlist
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(limit, offset) as WaitlistRow[];
}

export function listWaitlistPendingLaunch(): WaitlistRow[] {
  return db
    .prepare(
      `SELECT id, email, created_at, launch_notified_at
       FROM waitlist
       WHERE launch_notified_at IS NULL
       ORDER BY created_at ASC`,
    )
    .all() as WaitlistRow[];
}

export function markLaunchNotified(email: string) {
  db.prepare(`UPDATE waitlist SET launch_notified_at = datetime('now') WHERE email = ?`).run(email);
}
