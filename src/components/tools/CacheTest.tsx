"use client";

import { useState } from "react";
import type { DemoEvent, Phase, PhaseStats } from "@/lib/cacheDemo";

/*
 * The page for the cache test. One click asks the server (src/app/api/demo/cache) to run the same
 * database report 100 times without a cache and 100 times with one. The server measures every
 * lookup and streams progress and results back, one JSON line at a time.
 */

type Result = Extract<DemoEvent, { type: "result" }>;
type State = {
  status: "idle" | "running" | "waiting" | "done" | "error";
  done: Record<Phase, number>;
  of: number;
  result?: Result;
  message?: string;
};

const START: State = { status: "running", done: { db: 0, cache: 0 }, of: 0 };
const MAX_WAITS = 5; // how many times to wait behind another visitor's run
const WAIT_MS = 2000;

const seconds = (ms: number) => `${(ms / 1000).toFixed(2)} s`;
const millis = (ms: number) => `${ms >= 100 ? Math.round(ms) : ms} ms`;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
const waitText = (s: number) => (s < 90 ? `${s} seconds` : s < 90 * 60 ? `${Math.ceil(s / 60)} minutes` : `${Math.round(s / 3600)} hours`);

const ROWS: [string, (stats: PhaseStats) => string][] = [
  ["Time for all 100 lookups", (s) => seconds(s.totalMs)],
  ["Typical lookup (median)", (s) => millis(s.p50Ms)],
  ["Slowest 5% of lookups", (s) => millis(s.p95Ms)],
  ["Database queries run", (s) => String(s.dbQueries)],
  ["Answers served from the cache", (s) => String(s.hits)],
];

export default function CacheTest() {
  const [state, setState] = useState<State>({ ...START, status: "idle" });

  function apply(e: DemoEvent) {
    if (e.type === "progress") setState((s) => ({ ...s, of: e.of, done: { ...s.done, [e.phase]: e.done } }));
    else if (e.type === "result") setState({ status: "done", done: { db: e.lookups, cache: e.lookups }, of: e.lookups, result: e });
    else setState((s) => ({ ...s, status: "error", message: e.message }));
  }

  // The server sends one JSON event per line while the test runs.
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
    // The stream ended without a result or an error: the connection dropped.
    setState((s) => (s.status === "running" ? { ...s, status: "error", message: "The connection dropped. Please try again." } : s));
  }

  // The last result stays on screen until a new run really starts, so a refused click loses nothing.
  async function run() {
    setState((s) => ({ ...s, status: "running", message: undefined }));
    try {
      for (let attempt = 0; ; attempt++) {
        const res = await fetch("/api/demo/cache", { method: "POST" });
        if (res.ok && res.body) {
          setState(START);
          return await read(res.body);
        }
        const body = await res.json().catch(() => ({}));
        if (body.reason === "busy" && attempt < MAX_WAITS) {
          setState((s) => ({ ...s, status: "waiting", message: "Another visitor is running the test. Yours starts when theirs ends." }));
          await sleep(WAIT_MS);
          continue;
        }
        const wait = body.retryAfter && body.reason !== "busy" ? ` You can run it again in ${waitText(body.retryAfter)}.` : "";
        setState((s) => ({ ...s, status: "error", message: (body.error ?? "Something went wrong. Please try again in a minute.") + wait }));
        return;
      }
    } catch {
      setState((s) => ({ ...s, status: "error", message: "Could not reach the server. Please try again." }));
    }
  }

  const { status, done, of, result, message } = state;
  const busy = status === "running" || status === "waiting";
  const progress = busy && !result && of > 0;
  const misses = result ? result.lookups - result.cache.hits : 0;

  return (
    <div className="panel">
      <div className="t-bar">
        <p className="t-status" role="status">
          {status === "idle" && "Each run takes a few seconds. The numbers change a little from run to run."}
          {progress && (done.db < of ? `Asking Postgres: ${done.db} of ${of} lookups done.` : `Asking through Redis: ${done.cache} of ${of} lookups done.`)}
          {busy && !progress && !message && "Starting..."}
          {status === "done" && "Measured on the server just now."}
          {message && <span className={status === "error" ? "bad" : undefined}>{message}</span>}
        </p>
        <button type="button" className="btn" onClick={run} disabled={busy}>
          {busy ? "Running..." : result ? "Run it again" : "Run the test"}
        </button>
      </div>

      <table className="t-table">
        <thead>
          <tr>
            <td />
            <th scope="col">Straight from Postgres</th>
            <th scope="col">Through the Redis cache</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map(([label, value]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{result ? value(result.db) : ""}</td>
              <td>{result ? value(result.cache) : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {result && (
        <ul className="t-points">
          <li>
            The cache answered {result.lookups} lookups with {plural(result.cache.dbQueries, "database query", "database queries")}. Without
            it, Postgres ran the report {result.db.dbQueries} times.
          </li>
          {misses > result.cache.dbQueries && (
            <li>
              {plural(misses, "lookup")} arrived before the cache was filled. They shared{" "}
              {plural(result.cache.dbQueries, "database query", "database queries")} instead of running {misses}.
            </li>
          )}
          <li>{result.sameAnswer ? "Both ways returned exactly the same answer." : "The two answers were different, which means the cache is wrong."}</li>
        </ul>
      )}
    </div>
  );
}
