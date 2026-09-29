import { createHash } from "node:crypto";

/** True when a browser sends this request from another site's page. */
export function isCrossSite(req: Request): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  return Boolean(origin && host && new URL(origin).host !== host);
}

/** First client IP as seen by Vercel's edge, or "unknown" in local dev. */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/** We never store raw IPs — only a salted hash, which is enough to rate-limit. */
export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? "";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}
