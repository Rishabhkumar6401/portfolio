"use client";

import { useState, type FormEvent } from "react";
import { links } from "@/content/profile";

type State = { kind: "idle" | "sending" | "ok" | "err"; message?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ContactForm() {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;

    // Quick checks for a friendly message; the server re-validates everything.
    if (!data.name?.trim() || !EMAIL.test(data.email ?? "") || (data.message ?? "").trim().length < 10) {
      setState({ kind: "err", message: "Please add your name, a valid email and a message of at least 10 characters." });
      return;
    }

    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        const first = data.name.trim().split(/\s+/)[0];
        setState({ kind: "ok", message: `Thanks, ${first}! Your message is in my inbox — I'll reply soon.` });
        form.reset();
      } else {
        setState({
          kind: "err",
          message: body.error ?? `Something went wrong. You can email me directly at ${links.email}.`,
        });
      }
    } catch {
      setState({ kind: "err", message: `Couldn't reach the server. You can email me directly at ${links.email}.` });
    }
  }

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <div className="row2">
        <label>
          Name
          <input name="name" required maxLength={80} autoComplete="name" placeholder="Your name" />
        </label>
        <label>
          Email
          <input name="email" type="email" required maxLength={120} autoComplete="email" placeholder="you@company.com" />
        </label>
      </div>
      <label>
        Message
        <textarea name="message" rows={5} required maxLength={2000} placeholder="Hi Rishabh, I'd like to talk about…" />
      </label>
      {/* Honeypot: invisible to people, tempting to bots. */}
      <input className="hp" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <button className="btn primary" type="submit" disabled={state.kind === "sending"}>
        {state.kind === "sending" ? "Sending…" : "Send message"}
      </button>
      <p className={`form-status${state.kind === "ok" ? " ok" : state.kind === "err" ? " err" : ""}`} role="status" aria-live="polite">
        {state.message}
      </p>
      <p className="form-note">I usually reply within a day — my inbox has better uptime than most APIs.</p>
    </form>
  );
}
