"use client";

import { useEffect, useRef, useState } from "react";
import type { DemoEvent, Phase, PhaseStats } from "@/lib/cacheDemo";

type Result = Extract<DemoEvent, { type: "result" }>;
type State = {
  status: "idle" | "running" | "waiting" | "done" | "error";
  done: Record<Phase, number>;
  of: number;
  result?: Result;
  message?: string;
};

const START: State = { status: "running", done: { db: 0, cache: 0 }, of: 0 };
const MAX_WAITS = 5; // how many times to queue behind another visitor's run
const WAIT_MS = 2000;

const seconds = (ms: number) => `${(ms / 1000).toFixed(2)} s`;
const millis = (ms: number) => `${ms >= 100 ? Math.round(ms).toLocaleString("en-US") : ms} ms`;
const times = (x: number) => (x >= 10 ? Math.round(x).toString() : x.toFixed(1));
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const waitText = (s: number) => (s < 60 ? `${s} s` : s < 90 * 60 ? `${Math.ceil(s / 60)} min` : `${Math.round(s / 3600)} h`);

function Lane({ name, fast, done, of, stats }: { name: string; fast?: boolean; done: number; of: number; stats?: PhaseStats }) {
  const pct = stats ? 100 : of ? (done / of) * 100 : 0;
  return (
    <div className="lane">
      <small>
        {name}
        <span>{stats ? `${seconds(stats.totalMs)} · p95 ${millis(stats.p95Ms)}` : done ? `${done} / ${of}` : "—"}</span>
      </small>
      <div className="track" role="progressbar" aria-label={name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
        <div className={fast ? "fill fast" : "fill"} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Summary({ r }: { r: Result }) {
  const speedup = r.db.totalMs / Math.max(1, r.cache.totalMs);
  const misses = r.lookups - r.cache.hits;
  const queries = (n: number) => `${n} database ${n === 1 ? "query" : "queries"}`;
  return (
    <>
      {speedup >= 1.5 ? (
        <>
          Through the cache: <em>{times(speedup)}× faster</em> — and {queries(r.cache.dbQueries)} instead of {r.db.dbQueries}.
        </>
      ) : (
        <>This time the cache barely helped — the network, not the database, was the slow part.</>
      )}
      <small>
        {r.cache.hits} cache hits · {misses} {misses === 1 ? "miss" : "misses"} → {queries(r.cache.dbQueries)} ·{" "}
        {r.sameAnswer ? "same answer both ways ✓" : "answers differed ✗"}
      </small>
    </>
  );
}

export default function CacheDemo() {
  const [state, setState] = useState<State>({ ...START, status: "idle" });
  // After a visitor hits a limit, the button locks until the server says a run is allowed again.
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(0);
  const race = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!lockedUntil) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= lockedUntil) {
        window.clearInterval(id);
        setState((s) => ({ ...s, message: undefined }));
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [lockedUntil]);

  function apply(e: DemoEvent) {
    if (e.type === "progress") setState((s) => ({ ...s, of: e.of, done: { ...s.done, [e.phase]: e.done } }));
    else if (e.type === "result") setState({ status: "done", done: { db: e.lookups, cache: e.lookups }, of: e.lookups, result: e });
    else setState((s) => ({ ...s, status: "error", message: e.message }));
  }

  // The server streams one JSON event per line while the test runs.
  async function read(body: ReadableStream<Uint8Array>) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const lines = (buffer + decoder.decode(value, { stream: true })).split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) if (line) apply(JSON.parse(line) as DemoEvent);
    }
    // Stream ended without a result or an error event: the connection dropped.
    setState((s) => (s.status === "running" ? { ...s, status: "error", message: "The connection dropped — try again." } : s));
  }

  // The previous result stays on screen until a new run actually starts, so a blocked click loses nothing.
  async function run() {
    setState((s) => ({ ...s, status: "running", message: undefined }));
    // On phones the bars sit below the button; bring them into view so the run is visible.
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    race.current?.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
    try {
      for (let attempt = 0; ; attempt++) {
        const res = await fetch("/api/demo/cache", { method: "POST" });
        if (res.ok && res.body) {
          setState(START);
          return await read(res.body);
        }
        const body = await res.json().catch(() => ({}));
        if (body.reason === "busy" && attempt < MAX_WAITS) {
          setState((s) => ({ ...s, status: "waiting", message: "Another visitor is running the test — you're next…" }));
          await sleep(WAIT_MS);
          continue;
        }
        if (body.retryAfter && body.reason !== "busy") {
          const t = Date.now();
          setNow(t);
          setLockedUntil(t + body.retryAfter * 1000);
        }
        setState((s) => ({ ...s, status: "error", message: body.error ?? "Something went wrong — try again in a minute." }));
        return;
      }
    } catch {
      setState((s) => ({ ...s, status: "error", message: "Couldn't reach the server — try again." }));
    }
  }

  const { status, done, of, result, message } = state;
  const busy = status === "running" || status === "waiting";
  const secondsLeft = Math.max(0, Math.ceil((lockedUntil - now) / 1000));
  // The previous result stays visible until the new run's stream starts, so only count progress without one.
  const cachePhase = !result && of > 0 && done.db === of;
  const label = secondsLeft
    ? `Try again in ${waitText(secondsLeft)}`
    : {
        idle: "Run the test",
        running: cachePhase ? "Querying Redis…" : "Querying Postgres…",
        waiting: "Waiting in line…",
        done: "Measure again",
        error: "Try again",
      }[status];

  return (
    <div className="demo reveal">
      <div>
        <div className="label">Live demo</div>
        <h2>Why caching matters</h2>
        <p>
          One click runs a report — the top 5 products across 100,000 orders — 100 times from Postgres, then 100 times
          through Redis.
        </p>
        <div className="why">
          Measured live on the server — open DevTools → Network to watch <code>/api/demo/cache</code>.
        </div>
        <div className="demo-cta">
          <button className="btn primary" type="button" onClick={run} disabled={busy || secondsLeft > 0}>
            {label}
          </button>
          <p className="demo-note">3 runs per hour — free tiers have feelings.</p>
        </div>
      </div>
      <div className="race" ref={race}>
        <Lane name="Postgres only" done={done.db} of={of} stats={result?.db} />
        <Lane name="Through Redis cache" fast done={done.cache} of={of} stats={result?.cache} />
        <div className="result" aria-live="polite">
          {result && <Summary r={result} />}
          {status === "idle" && (
            <span className="hint">Timings vary slightly from run to run.</span>
          )}
          {status === "running" && !result && (
            <span className="hint">
              {cachePhase ? "Redis is handing out the saved answer…" : "Postgres is adding up 100,000 orders… again."}
            </span>
          )}
          {message && <span className="msg">{message}</span>}
        </div>
      </div>
    </div>
  );
}
