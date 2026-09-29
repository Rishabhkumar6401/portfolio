import type { ContactInput } from "./contact";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Emails Rishabh about a new contact message via Resend (free plan, no domain needed).
 * Without a verified domain, Resend only allows sending from onboarding@resend.dev to the
 * account owner's own address — exactly what a "notify me" email needs.
 * Only ever sends to CONTACT_TO_EMAIL, never to the address a visitor typed, so the form
 * can't be abused to spam anyone. Returns false (and logs) on failure; the message is already saved.
 */
export async function notifyNewMessage(msg: Pick<ContactInput, "name" | "email" | "message">): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  if (!apiKey || !to) {
    console.warn("[contact] Resend is not configured — message saved, email skipped");
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: "Portfolio <onboarding@resend.dev>",
        to: [to],
        reply_to: msg.email,
        subject: `New message from ${msg.name}`,
        text: `${msg.name} <${msg.email}> wrote:\n\n${msg.message}\n\nReply to this email to answer them directly.`,
        html:
          `<p><strong>${escapeHtml(msg.name)}</strong> &lt;${escapeHtml(msg.email)}&gt; wrote:</p>` +
          `<p style="white-space:pre-wrap">${escapeHtml(msg.message)}</p>` +
          `<p style="color:#888">Reply to this email to answer them directly.</p>`,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("[contact] Resend rejected the email", res.status, (await res.text().catch(() => "")).slice(0, 300));
      return false;
    }
    return true;
  } catch (err) {
    console.error("[contact] Resend request failed", err instanceof Error ? err.message : err);
    return false;
  }
}
