import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "./config.js";
import { getAuthAdmin, isFirebaseAdminConfigured } from "./firebaseAdmin.js";

export type AdminPayload = { role: "admin"; email: string };

function adminEmails(): string[] {
  const raw = process.env.VITE_ADMIN_EMAILS || process.env.ADMIN_EMAIL || "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  void (async () => {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
      res.status(401).json({ error: "Admin token required." });
      return;
    }

    if (isFirebaseAdminConfigured()) {
      try {
        const decoded = await getAuthAdmin().verifyIdToken(token);
        const email = decoded.email?.toLowerCase();
        if (email && adminEmails().includes(email)) {
          (req as Request & { admin: AdminPayload }).admin = { role: "admin", email };
          next();
          return;
        }
      } catch {
        /* try legacy JWT below */
      }
    }

    try {
      const payload = jwt.verify(token, config.jwtSecret) as AdminPayload;
      if (payload.role !== "admin") {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      (req as Request & { admin: AdminPayload }).admin = payload;
      next();
    } catch {
      res.status(401).json({ error: "Invalid or expired token." });
    }
  })();
}
