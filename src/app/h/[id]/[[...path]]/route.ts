import { captureRequest, describeRequest, isHookId } from "@/lib/hooks";

type Context = { params: Promise<{ id: string; path?: string[] }> };

// Test URLs are called by other services and by browsers on other sites, so any origin is allowed.
function cors(req: Request): Record<string, string> {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS",
    "access-control-allow-headers": req.headers.get("access-control-request-headers") ?? "*",
    "cache-control": "no-store",
  };
}

// Any method on /h/<id> (and any path under it): store the request, then reply with the chosen status.
async function receive(req: Request, { params }: Context) {
  const { id, path } = await params;
  const headers = cors(req);
  const gone = () => Response.json({ ok: false, error: "This test URL has expired or never existed." }, { status: 404, headers });
  if (!isHookId(id)) return gone();

  try {
    const result = await captureRequest(id, await describeRequest(req, path));
    if (!result.ok) {
      if (result.reason === "gone") return gone();
      return Response.json(
        { ok: false, error: "This test URL is receiving too many requests. Please slow down." },
        { status: 429, headers: { ...headers, "retry-after": String(result.retryAfter) } },
      );
    }
    if (result.status === 204) return new Response(null, { status: 204, headers });
    return Response.json({ ok: result.status < 400, status: result.status }, { status: result.status, headers });
  } catch (err) {
    console.error("[hooks] capture failed", err instanceof Error ? err.message : err);
    return Response.json({ ok: false, error: "Something went wrong on my side." }, { status: 500, headers });
  }
}

export { receive as GET, receive as POST, receive as PUT, receive as PATCH, receive as DELETE, receive as HEAD, receive as OPTIONS };
