import { runCacheDemo, type DemoEvent } from "@/lib/cacheDemo";
import { redisConfigured } from "@/lib/redis";
import { clientIp, hashIp, isCrossSite } from "@/lib/request";
import { getSupabase } from "@/lib/supabase";

// A run takes a few seconds; the database treats a run as abandoned after 30 s (see supabase/migrations).
export const maxDuration = 30;
const RUN_DEADLINE_MS = 20_000;

// Raised by demo_try_start() when a run isn't allowed. For the two limits, the database also says
// (in the error details) how many seconds until a run is allowed again; retryAfter is the fallback.
const LIMITS = {
  busy: { retryAfter: 2, message: "Another visitor is running the test right now." },
  visitor_limit: { retryAfter: 3600, message: "You have used your 3 runs for this hour." },
  daily_limit: { retryAfter: 3600, message: "The test has reached today's limit of 100 runs." },
} as const;

const error = (status: number, message: string) => Response.json({ ok: false, error: message }, { status });

// POST /api/demo/cache — gate the run in Postgres, then stream progress and measured results as NDJSON.
export async function POST(req: Request) {
  if (isCrossSite(req)) return error(403, "Cross-site requests are not allowed.");
  if (!redisConfigured()) return error(503, "The cache test is not switched on yet.");

  const supabase = getSupabase();

  // Rate limits and "one run at a time" are enforced atomically in the database, before Redis is touched.
  const { data: runId, error: gateError } = await supabase.rpc("demo_try_start", { p_ip_hash: hashIp(clientIp(req)) });
  if (gateError) {
    const reason = (Object.keys(LIMITS) as (keyof typeof LIMITS)[]).find((r) => gateError.message?.includes(r));
    if (reason) {
      const retryAfter = Number(gateError.details) || LIMITS[reason].retryAfter;
      return Response.json(
        { ok: false, reason, error: LIMITS[reason].message, retryAfter },
        { status: 429, headers: { "retry-after": String(retryAfter) } },
      );
    }
    console.error("[demo] gate failed", gateError.code, gateError.message);
    return error(500, "Something went wrong on my side.");
  }

  const stop = new AbortController(); // fires if the visitor leaves mid-run
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: DemoEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          // The visitor disconnected; the run is already being stopped.
        }
      };
      try {
        await runCacheDemo(emit, AbortSignal.any([stop.signal, AbortSignal.timeout(RUN_DEADLINE_MS)]));
      } catch (err) {
        if (!stop.signal.aborted) console.error("[demo] run failed", err instanceof Error ? err.message : err);
        emit({ type: "error", message: "The test did not finish. Please try again in a minute." });
      } finally {
        // Free the "one run at a time" slot for the next visitor.
        const { error: finishError } = await supabase.rpc("demo_finish", { p_run_id: runId });
        if (finishError) console.error("[demo] finish failed", finishError.code, finishError.message);
        try {
          controller.close();
        } catch {
          // Already closed by a disconnect.
        }
      }
    },
    cancel() {
      stop.abort();
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}
