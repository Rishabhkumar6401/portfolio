import type { ContactInput } from "./contact";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Emails Rishabh about a new contact message via Brevo's transactional API.
 * Only ever sends to CONTACT_TO_EMAIL — never to the address a visitor typed,
 * otherwise the form could be abused to send spam to anyone.
 * Returns false (and logs) on failure; the message is already saved by then.
 */
export async function notifyNewMessage(msg: Pick<ContactInput, "name" | "email" | "message">): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY;
  const sender = process.env.BREVO_SENDER_EMAIL;
  const to = process.env.CONTACT_TO_EMAIL;
  if (!apiKey || !sender || !to) {
    console.warn("[contact] Brevo is not configured — message saved, email skipped");
    return false;
  }

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { name: "Portfolio contact form", email: sender },
        to: [{ email: to }],
        replyTo: { email: msg.email, name: msg.name },
        subject: `New message from ${msg.name}`,
        textContent: `${msg.name} <${msg.email}> wrote:\n\n${msg.message}\n\nReply to this email to answer them directly.`,
        htmlContent:
          `<p><strong>${escapeHtml(msg.name)}</strong> &lt;${escapeHtml(msg.email)}&gt; wrote:</p>` +
          `<p style="white-space:pre-wrap">${escapeHtml(msg.message)}</p>` +
          `<p style="color:#888">Reply to this email to answer them directly.</p>`,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("[contact] Brevo rejected the email", res.status, (await res.text().catch(() => "")).slice(0, 300));
      return false;
    }
    return true;
  } catch (err) {
    console.error("[contact] Brevo request failed", err instanceof Error ? err.message : err);
    return false;
  }
}
