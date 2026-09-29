import { createHash } from "node:crypto";
import { z } from "zod";

// Server-side source of truth for what a valid contact message looks like.
// The form checks the same rules in the browser, but only this one is trusted.
export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Please add your name.")
    .max(80, "Name is too long.")
    .regex(/^[^\r\n\t<>]+$/, "Name contains characters that aren't allowed."),
  email: z.string().trim().max(120, "Email is too long.").pipe(z.email("Please add a valid email address.")),
  message: z
    .string()
    .trim()
    .min(10, "Message should be at least 10 characters.")
    .max(2000, "Message is too long (2,000 characters max)."),
  // Honeypot: hidden from people, filled in by bots.
  company: z.string().max(200).optional().default(""),
});

export type ContactInput = z.infer<typeof contactSchema>;

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
