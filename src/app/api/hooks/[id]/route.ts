import { z } from "zod";
import { deleteHook, isHookId, isViewKey, readRequests, setReplyStatus } from "@/lib/hooks";
import { RESPONSE_STATUSES } from "@/lib/hookShared";
import { clientIp, hashIp, isCrossSite } from "@/lib/request";

type Context = { params: Promise<{ id: string }> };

const noStore = { "cache-control": "no-store" };
const error = (status: number, message: string, headers?: HeadersInit) =>
  Response.json({ ok: false, error: message }, { status, headers: { ...noStore, ...headers } });

const GONE = "This test URL has expired or was deleted.";
const failures = {
  gone: () => error(404, GONE),
  forbidden: () => error(403, "The view key does not match this test URL."),
};

/** Every call needs the id from the path and the view key from the "x-hook-key" header. */
async function credentials(req: Request, { params }: Context) {
  if (isCrossSite(req)) return error(403, "Cross-site requests are not allowed.");
  const { id } = await params;
  const key = req.headers.get("x-hook-key");
  // A wrong shape is answered here, without a trip to Redis.
  if (!isHookId(id)) return error(404, GONE);
  if (!isViewKey(key)) return error(403, "The view key does not match this test URL.");
  return { id, key };
}

// GET /api/hooks/<id>?after=<n>: the requests that arrived after request number n.
export async function GET(req: Request, context: Context) {
  const who = await credentials(req, context);
  if (who instanceof Response) return who;

  const after = Number(new URL(req.url).searchParams.get("after") ?? 0);
  if (!Number.isSafeInteger(after) || after < 0) return error(400, "\"after\" must be a whole number.");

  try {
    const result = await readRequests(who.id, who.key, after, hashIp(clientIp(req)));
    if (result.ok) return Response.json(result, { headers: noStore });
    if (result.reason === "rate_limit") {
      return error(429, "Too many requests. Please slow down.", { "retry-after": String(result.retryAfter) });
    }
    return failures[result.reason]();
  } catch (err) {
    console.error("[hooks] read failed", err instanceof Error ? err.message : err);
    return error(500, "Something went wrong on my side.");
  }
}

const Settings = z.object({
  status: z.union(RESPONSE_STATUSES.map((code) => z.literal(code))),
});

// PATCH /api/hooks/<id>: choose the status the test URL replies with.
export async function PATCH(req: Request, context: Context) {
  const who = await credentials(req, context);
  if (who instanceof Response) return who;

  const settings = Settings.safeParse(await req.json().catch(() => null));
  if (!settings.success) return error(400, `"status" must be one of ${RESPONSE_STATUSES.join(", ")}.`);

  try {
    const result = await setReplyStatus(who.id, who.key, settings.data.status);
    return result.ok ? Response.json({ ok: true, status: settings.data.status }, { headers: noStore }) : failures[result.reason]();
  } catch (err) {
    console.error("[hooks] update failed", err instanceof Error ? err.message : err);
    return error(500, "Something went wrong on my side.");
  }
}

// DELETE /api/hooks/<id>: remove the test URL and everything it received.
export async function DELETE(req: Request, context: Context) {
  const who = await credentials(req, context);
  if (who instanceof Response) return who;

  try {
    const result = await deleteHook(who.id, who.key);
    return result.ok ? Response.json({ ok: true }, { headers: noStore }) : failures[result.reason]();
  } catch (err) {
    console.error("[hooks] delete failed", err instanceof Error ? err.message : err);
    return error(500, "Something went wrong on my side.");
  }
}
