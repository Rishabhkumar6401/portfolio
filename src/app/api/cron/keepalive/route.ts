import { getSupabase } from "@/lib/supabase";

// GET /api/cron/keepalive — called once a day by Vercel Cron (see vercel.json).
// Free Supabase projects pause after 7 days without activity; one tiny query a day prevents that.
// Vercel sends "Authorization: Bearer <CRON_SECRET>", so nobody else can trigger it.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await getSupabase().rpc("ping");
  if (error) {
    console.error("[keepalive] ping failed", error.code, error.message);
    return Response.json({ ok: false }, { status: 502 });
  }
  return Response.json({ ok: true, databaseTime: data });
}
