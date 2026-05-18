import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "./config.js";

export type AdminPayload = { role: "admin"; email: string };

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Admin token required." });

  try {
    const payload = jwt.verify(token, config.jwtSecret) as AdminPayload;
    if (payload.role !== "admin") return res.status(401).json({ error: "Unauthorized" });
    (req as Request & { admin: AdminPayload }).admin = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}
