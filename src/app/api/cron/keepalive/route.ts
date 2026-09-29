import { redis, redisConfigured } from "@/lib/redis";
import { getSupabase } from "@/lib/supabase";

// GET /api/cron/keepalive — called once a day by Vercel Cron (see vercel.json).
// Free Supabase projects pause after 7 days without activity, and free Upstash Redis databases are
// archived after 30; one tiny request to each a day prevents both.
// Vercel sends "Authorization: Bearer <CRON_SECRET>", so nobody else can trigger it.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await getSupabase().rpc("ping");
  if (error) console.error("[keepalive] database ping failed", error.code, error.message);

  let redisOk = !redisConfigured(); // nothing to keep alive if Redis isn't set up
  if (!redisOk) {
    try {
      redisOk = (await redis(["PING"])) === "PONG";
    } catch (err) {
      console.error("[keepalive] redis ping failed", err instanceof Error ? err.message : err);
    }
  }

  const ok = !error && redisOk;
  return Response.json({ ok, databaseTime: data ?? null, redis: redisOk }, { status: ok ? 200 : 502 });
}
