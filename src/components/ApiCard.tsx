"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";

type Segment = { text: string; cls: "" | "k" | "s" | "p" };
type Status = { code: number; text: string; type: string; ms: number };

/** Split pretty-printed JSON into coloured pieces: keys, strings, punctuation. */
function tokenize(json: string): Segment[] {
  const out: Segment[] = [];
  const re = /("(?:[^"\\]|\\.)*")(\s*:)?|([{}\[\],])/g;
  let last = 0;
  for (let m = re.exec(json); m; m = re.exec(json)) {
    if (m.index > last) out.push({ text: json.slice(last, m.index), cls: "" });
    if (m[3]) out.push({ text: m[3], cls: "p" });
    else if (m[2]) out.push({ text: m[1], cls: "k" }, { text: m[2], cls: "p" });
    else out.push({ text: m[1], cls: "s" });
    last = re.lastIndex;
  }
  if (last < json.length) out.push({ text: json.slice(last), cls: "" });
  return out;
}

/** The first `count` characters of the response, keeping each piece's colour. Pure — safe to call in render. */
function visibleSegments(segments: Segment[], count: number): Segment[] {
  const out: Segment[] = [];
  let left = count;
  for (const s of segments) {
    if (left <= 0) break;
    const text = s.text.slice(0, left);
    left -= text.length;
    out.push({ text, cls: s.cls });
  }
  return out;
}

export default function ApiCard() {
  const [phase, setPhase] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [status, setStatus] = useState<Status | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [typed, setTyped] = useState(0);
  const [total, setTotal] = useState(0);
  const card = useRef<HTMLDivElement>(null);

  // A real request to this site's own API; the time shown is measured in the browser.
  const send = useCallback(async () => {
    setPhase("loading");
    setTyped(0);
    try {
      const t0 = performance.now();
      const res = await fetch("/api/rishabh", { cache: "no-store", headers: { accept: "application/json" } });
      const body = await res.json();
      const ms = Math.max(1, Math.round(performance.now() - t0));
      const json = JSON.stringify(body, null, 2);
      // Decide here, not in an effect: reduced-motion visitors get the full response at once.
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setTotal(json.length);
      setTyped(reduceMotion ? json.length : 0);
      setSegments(tokenize(json));
      setStatus({
        code: res.status,
        text: res.statusText || (res.ok ? "OK" : "Error"),
        type: (res.headers.get("content-type") ?? "").split(";")[0],
        ms,
      });
      setPhase("done");
    } catch {
      setPhase("error");
    }
  }, []);

  // Type the response out, a few characters per frame.
  useEffect(() => {
    if (phase !== "done") return;
    const id = window.setInterval(() => {
      setTyped((n) => {
        const next = Math.min(total, n + 5);
        if (next >= total) window.clearInterval(id);
        return next;
      });
    }, 12);
    return () => window.clearInterval(id);
  }, [phase, total]);

  // Fire once automatically when the card first scrolls into view.
  useEffect(() => {
    const el = card.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          io.disconnect();
          window.setTimeout(send, 600);
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [send]);

  const busy = phase === "loading" || (phase === "done" && typed < total);

  return (
    <div className="api reveal" ref={card} aria-label="Live API request returning information about Rishabh">
      <div className="api-bar">
        <div className="dots" aria-hidden="true"><i /><i /><i /></div>
        <div className="req"><span className="m">GET</span><span className="u">/api/rishabh</span></div>
        <button className="send" type="button" onClick={send} disabled={busy}>
          {phase === "idle" ? "Send request" : "Send again"}
        </button>
      </div>
      <div className="api-status" aria-live="polite">
        <span>
          {phase === "idle" && "Press “Send request”"}
          {phase === "loading" && "Sending…"}
          {phase === "error" && "Network error — try again"}
          {phase === "done" && status && (
            <>
              <span className="s200">{status.code} {status.text}</span> · {status.type}
            </>
          )}
        </span>
        <span>{phase === "done" && status ? `${status.ms} ms` : ""}</span>
      </div>
      <pre>
        {phase === "done" ? (
          <>
            {visibleSegments(segments, typed).map((s, i) =>
              s.cls ? <span key={i} className={s.cls}>{s.text}</span> : <Fragment key={i}>{s.text}</Fragment>,
            )}
            {typed < total && <span className="caret" />}
          </>
        ) : phase === "loading" ? (
          <span className="caret" />
        ) : (
          <span className="p">{"// Like every good API, this one tells you\n// exactly what you're getting."}</span>
        )}
      </pre>
      <div className="api-foot">Send it again — same answer every time. That&apos;s called idempotency.</div>
    </div>
  );
}
