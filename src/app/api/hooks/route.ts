import { createHook } from "@/lib/hooks";
import { redisConfigured } from "@/lib/redis";
import { clientIp, hashIp, isCrossSite } from "@/lib/request";

const LIMIT_MESSAGES = {
  visitor_limit: "You have created several test URLs in the last hour. Please reuse one, or try again later.",
  daily_limit: "The webhook tester has reached today's limit. Please try again tomorrow.",
  rate_limit: "Too many requests. Please slow down.",
} as const;

const error = (status: number, message: string, headers?: HeadersInit) =>
  Response.json({ ok: false, error: message }, { status, headers });

// POST /api/hooks: create a test URL. The reply holds the view key; it is shown once and never stored here.
export async function POST(req: Request) {
  if (isCrossSite(req)) return error(403, "Cross-site requests are not allowed.");
  if (!redisConfigured()) return error(503, "The webhook tester is not switched on yet.");

  try {
    const hook = await createHook(hashIp(clientIp(req)));
    if (!hook.ok) return error(429, LIMIT_MESSAGES[hook.reason], { "retry-after": String(hook.retryAfter) });

    const url = `${new URL(req.url).origin}/h/${hook.id}`;
    return Response.json(
      { ok: true, id: hook.id, key: hook.key, url, expiresAt: hook.expiresAt },
      { status: 201, headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    console.error("[hooks] create failed", err instanceof Error ? err.message : err);
    return error(500, "Something went wrong on my side.");
  }
}
