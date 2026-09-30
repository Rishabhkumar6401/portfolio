"use client";

import { useState } from "react";

/** The email address with a Copy button. If the clipboard is unavailable, it opens the mail app instead. */
export default function CopyEmail({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.location.href = `mailto:${email}`;
    }
  };

  return (
    <div className="field reveal">
      <a href={`mailto:${email}`}>{email}</a>
      <button className="btn" type="button" onClick={copy} aria-live="polite">
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
