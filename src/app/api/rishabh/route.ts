import { apiProfile } from "@/content/profile";

// GET /api/rishabh — the endpoint the hero card calls.
// Public and read-only, so any origin may call it (try: curl https://<site>/api/rishabh).
export function GET() {
  return Response.json(apiProfile, {
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
