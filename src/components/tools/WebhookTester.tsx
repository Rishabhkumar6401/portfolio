"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { base64ToBytes, bytesToBase64, bytesToHex, formatBytes, hmac, relativeTime, utf8 } from "@/lib/encoding";
import { MAX_BODY_BYTES, MAX_STORED_REQUESTS, RESPONSE_STATUSES, type ListedRequest, type ResponseStatus } from "@/lib/hookShared";
import { checkJson, formatJson } from "@/lib/json";
import CopyButton from "./CopyButton";
import { useNow } from "./useNow";

/*
 * The page for the webhook tester. The server side is in src/lib/hooks.ts.
 *
 * The page asks the server for new requests every few seconds. It slows down when nothing arrives,
 * stops while the tab is in the background, and pauses after a quiet spell, so an open tab that
 * nobody is watching costs almost nothing.
 */

const FAST_MS = 2000; // how often to ask while requests are arriving
const SLOW_MS = 5000; // how often after two quiet minutes
const SLOW_AFTER_MS = 2 * 60 * 1000;
const PAUSE_AFTER_MS = 15 * 60 * 1000;

// ---------------------------------------------------------------------------------------------
// The test URL and its view key are kept in the browser, so a reload brings the same URL back.

type Session = { id: string; key: string; url: string; expiresAt: number };

const STORE_KEY = "webhook-tester";
const listeners = new Set<() => void>();
let memory: string | null = null; // used when the browser blocks storage

function readStore(): string | null {
  try {
    return localStorage.getItem(STORE_KEY) ?? memory;
  } catch {
    return memory;
  }
}

function writeStore(session: Session | null) {
  memory = session ? JSON.stringify(session) : null;
  try {
    if (memory) localStorage.setItem(STORE_KEY, memory);
    else localStorage.removeItem(STORE_KEY);
  } catch {
    /* private mode: the URL still works until the tab is closed */
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function parseSession(raw: string | null): Session | null {
  try {
    const s = JSON.parse(raw ?? "null") as Partial<Session> | null;
    if (s && typeof s.id === "string" && typeof s.key === "string" && typeof s.url === "string" && typeof s.expiresAt === "number") {
      return { id: s.id, key: s.key, url: s.url, expiresAt: s.expiresAt };
    }
  } catch {
    /* not ours: ignore it */
  }
  return null;
}

// ---------------------------------------------------------------------------------------------

export default function WebhookTester() {
  const raw = useSyncExternalStore(subscribe, readStore, () => null);
  const session = useMemo(() => parseSession(raw), [raw]);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");

  const create = async () => {
    setCreating(true);
    setNotice("");
    try {
      const res = await fetch("/api/hooks", { method: "POST" });
      const data = await res.json();
      if (res.ok) writeStore({ id: data.id, key: data.key, url: data.url, expiresAt: data.expiresAt });
      else setNotice(data.error ?? "Could not create a test URL.");
    } catch {
      setNotice("Could not reach the server. Check your connection and try again.");
    }
    setCreating(false);
  };

  const close = useCallback((message: string) => {
    writeStore(null);
    setNotice(message);
  }, []);

  if (session) return <Inbox key={session.id} session={session} onClosed={close} />;

  return (
    <div className="panel wh-start">
      <p>You get a private URL that accepts any request for 24 hours.</p>
      <button type="button" className="btn" onClick={create} disabled={creating}>
        {creating ? "Creating..." : "Create a test URL"}
      </button>
      {notice && (
        <p className="t-status bad" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}

function Inbox({ session, onClosed }: { session: Session; onClosed: (message: string) => void }) {
  const [requests, setRequests] = useState<ListedRequest[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [status, setStatus] = useState<ResponseStatus>(200);
  const [paused, setPaused] = useState(false);
  const [problem, setProblem] = useState(false);
  const [sending, setSending] = useState(false);
  const [wake, setWake] = useState(0); // raised to ask the server straight away
  const cursor = useRef(0); // the number of the newest request already shown
  const saving = useRef(false);
  const now = useNow(30_000);

  useEffect(() => {
    if (paused) return;
    let stopped = false;
    let timer = 0;
    let lastActivity = Date.now();

    const poll = async () => {
      if (stopped) return;
      let delay = FAST_MS;
      if (!document.hidden) {
        try {
          const res = await fetch(`/api/hooks/${session.id}?after=${cursor.current}`, {
            headers: { "x-hook-key": session.key },
            cache: "no-store",
          });
          if (stopped) return;
          if (res.status === 404 || res.status === 403) return onClosed("That test URL has expired. Create a new one.");
          if (res.status === 429) delay = (Number(res.headers.get("retry-after")) || 10) * 1000;
          else if (!res.ok) throw new Error(`Unexpected reply ${res.status}`);
          else {
            const data = (await res.json()) as { seq: number; status: ResponseStatus; requests: ListedRequest[] };
            if (stopped) return;
            cursor.current = data.seq;
            if (!saving.current) setStatus(data.status);
            if (data.requests.length) {
              lastActivity = Date.now();
              setRequests((shown) => [...data.requests, ...shown].slice(0, MAX_STORED_REQUESTS));
            }
          }
          setProblem(false);
        } catch {
          if (stopped) return;
          setProblem(true);
          delay = SLOW_MS;
        }
        const quiet = Date.now() - lastActivity;
        if (quiet > PAUSE_AFTER_MS) return setPaused(true);
        if (quiet > SLOW_AFTER_MS) delay = Math.max(delay, SLOW_MS);
      }
      timer = window.setTimeout(poll, delay);
    };

    timer = window.setTimeout(poll, 0);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [session.id, session.key, paused, wake, onClosed]);

  const resume = () => {
    setPaused(false);
    setWake((n) => n + 1);
  };

  const sendTest = async () => {
    setSending(true);
    try {
      await fetch(session.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event: "test.ping", message: "Hello from the webhook tester", sent_at: new Date().toISOString() }),
      });
    } catch {
      /* the next check shows whether it arrived */
    }
    setSending(false);
    resume();
  };

  const changeStatus = async (next: ResponseStatus) => {
    const previous = status;
    saving.current = true;
    setStatus(next);
    try {
      const res = await fetch(`/api/hooks/${session.id}`, {
        method: "PATCH",
        headers: { "x-hook-key": session.key, "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error(`Unexpected reply ${res.status}`);
    } catch {
      setStatus(previous);
    }
    saving.current = false;
  };

  const remove = async () => {
    await fetch(`/api/hooks/${session.id}`, { method: "DELETE", headers: { "x-hook-key": session.key } }).catch(() => null);
    onClosed("");
  };

  const current = requests.find((r) => r.seq === selected) ?? requests[0];
  const sample = `curl -X POST ${session.url} -H 'content-type: application/json' -d '{"hello":"world"}'`;

  return (
    <div className="panel wh">
      <div className="wh-url">
        <span className="t-label">Your test URL</span>
        <div className="field">
          <code>{session.url}</code>
          <CopyButton text={session.url} className="btn" />
        </div>
      </div>

      <div className="wh-meta">
        <span className={paused || problem ? "wh-live off" : "wh-live"} role="status">
          {paused ? "Paused after 15 quiet minutes." : problem ? "Connection problem. Trying again." : "Listening for requests"}
        </span>
        {paused && (
          <button type="button" className="btn small" onClick={resume}>
            Resume
          </button>
        )}
        {now !== null && <span>Expires {relativeTime(session.expiresAt, now)}</span>}
        <label className="wh-reply">
          Reply with
          <select name="reply-status" value={status} onChange={(e) => changeStatus(Number(e.target.value) as ResponseStatus)}>
            {RESPONSE_STATUSES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
        <span className="wh-buttons">
          <button type="button" className="btn small light" onClick={sendTest} disabled={sending}>
            {sending ? "Sending..." : "Send a test request"}
          </button>
          <button type="button" className="btn small light" onClick={remove}>
            Delete URL
          </button>
        </span>
      </div>

      {requests.length === 0 ? (
        <div className="wh-empty">
          <p>Waiting for the first request. Paste the URL into the other service, or try it from a terminal:</p>
          <pre className="t-out auto wrap">{sample}</pre>
          <CopyButton text={sample} label="Copy command" />
        </div>
      ) : (
        <div className="wh-cols">
          <ol className="wh-list" aria-label="Requests, newest first">
            {requests.map((request) => (
              <li key={request.seq}>
                <button type="button" className={request === current ? "on" : undefined} onClick={() => setSelected(request.seq)}>
                  <b className={`method ${request.method.toLowerCase()}`}>{request.method}</b>
                  <span>{request.path || "/"}</span>
                  <small>
                    {new Date(request.at).toLocaleTimeString()}
                    <em>{formatBytes(request.bodyBytes)}</em>
                  </small>
                </button>
              </li>
            ))}
          </ol>
          {current && <RequestDetail key={current.seq} request={current} url={session.url} />}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

const quote = (text: string) => `'${text.replace(/'/g, `'\\''`)}'`;
const CURL_SKIPS = ["host", "content-length", "connection", "accept-encoding"];

/** The same request as a curl command, to replay it against your own server. */
function toCurl(request: ListedRequest, address: string): string {
  const lines = [`curl -X ${request.method} ${quote(address)}`];
  for (const [name, value] of request.headers) {
    if (!CURL_SKIPS.includes(name)) lines.push(`-H ${quote(`${name}: ${value}`)}`);
  }
  if (request.body && request.bodyEncoding === "utf8" && !request.truncated) lines.push(`--data-raw ${quote(request.body)}`);
  return lines.join(" \\\n  ");
}

function RequestDetail({ request, url }: { request: ListedRequest; url: string }) {
  const [raw, setRaw] = useState(false);
  const address = url + request.path + (request.query ? `?${request.query}` : "");
  const query = useMemo(() => [...new URLSearchParams(request.query)], [request.query]);
  const pretty = useMemo(() => {
    if (request.bodyEncoding !== "utf8" || request.truncated || !/^\s*[[{]/.test(request.body)) return null;
    return checkJson(request.body).ok ? formatJson(request.body, "  ") : null;
  }, [request]);
  const body = pretty && !raw ? pretty : request.body;

  return (
    <div className="wh-detail">
      <div className="wh-head">
        <b className={`method ${request.method.toLowerCase()}`}>{request.method}</b>
        <code>{address}</code>
      </div>
      <dl className="t-rows">
        <div>
          <dt>Received</dt>
          <dd>{new Date(request.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" })}</dd>
        </div>
        <div>
          <dt>Sender IP</dt>
          <dd>{request.ip}</dd>
        </div>
        <div>
          <dt>Body size</dt>
          <dd>{formatBytes(request.bodyBytes)}</dd>
        </div>
      </dl>

      <div className="t-label">
        Body
        <span className="t-actions">
          {pretty && (
            <button type="button" className="btn small light" onClick={() => setRaw(!raw)}>
              {raw ? "Show formatted" : "Show raw"}
            </button>
          )}
          <CopyButton text={request.body} />
        </span>
      </div>
      {request.body ? <pre className="t-out auto">{body}</pre> : <p className="t-status">This request has no body.</p>}
      {request.bodyEncoding === "base64" && <p className="t-status">The body is not text, so it is shown as Base64.</p>}
      {request.truncated && (
        <p className="t-status">
          Only the first {formatBytes(MAX_BODY_BYTES)} of this {formatBytes(request.bodyBytes)} body was kept.
        </p>
      )}

      {query.length > 0 && (
        <>
          <div className="t-label">Query parameters</div>
          <dl className="t-rows mono">
            {query.map(([name, value], i) => (
              <div key={i}>
                <dt>{name}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}

      <div className="t-label">
        Headers
        <CopyButton text={toCurl(request, address)} label="Copy as curl" />
      </div>
      <dl className="t-rows mono">
        {request.headers.map(([name, value], i) => (
          <div key={i}>
            <dt>{name}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <SignatureCheck request={request} />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

type Verdict = { valid: boolean; how: string } | { error: string };

/** Recomputes the signature from the body and the secret, and compares it with the header. */
async function checkSignature(request: ListedRequest, headerName: string, secret: string): Promise<Verdict> {
  const given = request.headers.find(([name]) => name === headerName)?.[1];
  if (!given) return { error: "This request does not have that header." };
  if (request.truncated) return { error: "The body was cut at 16 KB, so its signature cannot be checked." };
  const body = request.bodyEncoding === "base64" ? (base64ToBytes(request.body) ?? new Uint8Array()) : utf8(request.body);

  if (headerName === "stripe-signature") {
    // Stripe signs "<timestamp>.<body>" and sends "t=<timestamp>,v1=<signature>".
    const pairs = given.split(",").map((pair) => pair.trim().split("="));
    const timestamp = pairs.find(([name]) => name === "t")?.[1];
    const signatures = pairs.filter(([name]) => name === "v1").map(([, value]) => value);
    if (!timestamp || !signatures.length) return { error: "The Stripe-Signature header is not in the expected format." };
    const prefix = utf8(`${timestamp}.`);
    const signed = new Uint8Array(prefix.length + body.length);
    signed.set(prefix);
    signed.set(body, prefix.length);
    const mac = bytesToHex(await hmac("SHA-256", utf8(secret), signed));
    return { valid: signatures.includes(mac), how: "Stripe format: HMAC SHA-256 of the timestamp, a dot and the body." };
  }

  // GitHub sends "sha256=<hex>". Shopify sends Base64. Others send plain hex.
  const mac = await hmac("SHA-256", utf8(secret), body);
  const value = given.trim().replace(/^sha256=/i, "");
  const valid =
    value.toLowerCase() === bytesToHex(mac) || value === bytesToBase64(mac) || value.replace(/=+$/, "") === bytesToBase64(mac, true);
  return { valid, how: "HMAC SHA-256 of the body, compared as hex and as Base64." };
}

function SignatureCheck({ request }: { request: ListedRequest }) {
  const names = request.headers.map(([name]) => name);
  const likely = names.find((n) => n === "x-hub-signature-256" || n === "stripe-signature") ?? names.find((n) => /signature|hmac/.test(n)) ?? "";
  const [headerName, setHeaderName] = useState(likely);
  const [secret, setSecret] = useState("");
  const [checked, setChecked] = useState<{ for: string; verdict: Verdict } | null>(null);

  // The check is asynchronous, so its answer is stored with the inputs it belongs to.
  const checkFor = headerName && secret ? `${headerName}\n${secret}` : null;
  useEffect(() => {
    if (!checkFor) return;
    let cancelled = false;
    checkSignature(request, headerName, secret).then((verdict) => {
      if (!cancelled) setChecked({ for: checkFor, verdict });
    });
    return () => {
      cancelled = true;
    };
  }, [checkFor, request, headerName, secret]);
  const verdict = checkFor && checked?.for === checkFor ? checked.verdict : null;

  return (
    <details className="wh-sign" open={Boolean(likely)}>
      <summary>Check the signature</summary>
      <div className="t-inline">
        <select name="signature-header" aria-label="Header that carries the signature" value={headerName} onChange={(e) => setHeaderName(e.target.value)}>
          <option value="">Choose the signature header</option>
          {names.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <input
          className="t-input"
          aria-label="Signing secret"
          name="signing-secret"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Signing secret"
          spellCheck={false}
          autoComplete="off"
        />
      </div>
      <p className="t-status" role="status">
        {!verdict && "The secret is used in your browser only. It is not sent to the server."}
        {verdict && "error" in verdict && <span className="bad">{verdict.error}</span>}
        {verdict && "valid" in verdict && (
          <>
            <span className={verdict.valid ? "good" : "bad"}>{verdict.valid ? "The signature is valid." : "The signature does not match."}</span> {verdict.how}
          </>
        )}
      </p>
    </details>
  );
}
