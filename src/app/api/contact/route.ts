import { contactSchema } from "@/lib/contact";
import { notifyNewMessage } from "@/lib/notify";
import { clientIp, hashIp, isCrossSite } from "@/lib/request";
import { getSupabase } from "@/lib/supabase";

const MAX_BODY_BYTES = 10_000;

const error = (status: number, message: string) => Response.json({ ok: false, error: message }, { status });

// POST /api/contact — validate → save (rate-limited in the database) → email Rishabh.
export async function POST(req: Request) {
  // Only accept submissions from this site's own pages.
  if (isCrossSite(req)) return error(403, "Cross-site submissions are not allowed.");

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return error(413, "That message is too large.");

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return error(400, "Invalid request.");
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) return error(400, parsed.error.issues[0]?.message ?? "Please check the form and try again.");

  const { name, email, message, company } = parsed.data;

  // Honeypot filled in → almost certainly a bot. Pretend it worked, store nothing.
  if (company) return Response.json({ ok: true }, { status: 201 });

  // The database function enforces the rate limit atomically (see supabase/migrations).
  const { error: dbError } = await getSupabase().rpc("submit_contact", {
    p_name: name,
    p_email: email,
    p_message: message,
    p_ip_hash: hashIp(clientIp(req)),
  });

  if (dbError) {
    if (dbError.message?.includes("rate_limited")) {
      return error(429, "You've sent a few messages already — please try again in a few minutes.");
    }
    console.error("[contact] save failed", dbError.code, dbError.message);
    return error(500, "Something went wrong on my side.");
  }

  // Saved. A failed email is logged but not shown as an error — resubmitting would only duplicate the message.
  await notifyNewMessage({ name, email, message });

  return Response.json({ ok: true }, { status: 201 });
}
