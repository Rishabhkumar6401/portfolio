import { redis } from "./redis";
import { getSupabase } from "./supabase";

// One run = LOOKUPS lookups straight from Postgres, then LOOKUPS through a Redis cache.
const LOOKUPS = 100;
const PARALLEL = 10; // lookups in flight at once — like 10 visitors hitting an API together
const CACHE_KEY = "demo:top-products";
const CACHE_TTL_SECONDS = 60;

export type Phase = "db" | "cache";

export type PhaseStats = {
  totalMs: number; // wall-clock time for all lookups
  p50Ms: number;
  p95Ms: number;
  dbQueries: number; // times Postgres actually ran the report
  hits: number; // cache hits (always 0 for the Postgres-only phase)
};

export type DemoEvent =
  | { type: "progress"; phase: Phase; done: number; of: number }
  | { type: "result"; lookups: number; db: PhaseStats; cache: PhaseStats; sameAnswer: boolean }
  | { type: "error"; message: string };

type Report = unknown;

/** The expensive part: Postgres aggregates all 100,000 orders on every call — it has no result cache. */
async function queryReport(): Promise<Report> {
  const { data, error } = await getSupabase().rpc("demo_top_products");
  if (error) throw new Error(`demo_top_products failed: ${error.code} ${error.message}`);
  return data;
}

/** Runs `lookup` LOOKUPS times, PARALLEL at a time, timing each one. */
async function runLookups(lookup: () => Promise<Report>, onProgress: (done: number) => void, signal: AbortSignal) {
  const latencies: number[] = [];
  let answer: Report = null;
  let started = 0;
  let failed = false;

  async function worker() {
    while (started < LOOKUPS && !failed) {
      signal.throwIfAborted();
      started++;
      const t0 = performance.now();
      try {
        answer = await lookup();
      } catch (err) {
        failed = true; // stop the other workers too
        throw err;
      }
      latencies.push(performance.now() - t0);
      if (latencies.length % 10 === 0) onProgress(latencies.length);
    }
  }

  const t0 = performance.now();
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  return { latencies, totalMs: performance.now() - t0, answer };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function stats(run: { latencies: number[]; totalMs: number }, dbQueries: number, hits: number): PhaseStats {
  const sorted = [...run.latencies].sort((a, b) => a - b);
  const pct = (p: number) => round1(sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)]);
  return { totalMs: Math.round(run.totalMs), p50Ms: pct(0.5), p95Ms: pct(0.95), dbQueries, hits };
}

/** Runs both phases, reporting progress through `emit`, and finishes with a "result" event. */
export async function runCacheDemo(emit: (e: DemoEvent) => void, signal: AbortSignal): Promise<void> {
  const progress = (phase: Phase) => (done: number) => emit({ type: "progress", phase, done, of: LOOKUPS });

  // Phase 1: every lookup goes straight to Postgres.
  const db = await runLookups(queryReport, progress("db"), signal);

  // Phase 2: cache-aside through Redis, starting from an empty cache so the first lookups really miss.
  await redis(["DEL", CACHE_KEY]);
  let dbQueries = 0;
  let hits = 0;
  let inflight: Promise<Report> | null = null;

  const cachedLookup = async (): Promise<Report> => {
    const cached = await redis(["GET", CACHE_KEY]);
    if (cached !== null) {
      hits++;
      return JSON.parse(String(cached));
    }
    // Miss. Misses that arrive together share one Postgres query instead of stampeding the database.
    inflight ??= (async () => {
      dbQueries++;
      const fresh = await queryReport();
      await redis(["SET", CACHE_KEY, JSON.stringify(fresh), "EX", CACHE_TTL_SECONDS]);
      return fresh;
    })().finally(() => {
      inflight = null;
    });
    return inflight;
  };

  const cache = await runLookups(cachedLookup, progress("cache"), signal);

  emit({
    type: "result",
    lookups: LOOKUPS,
    db: stats(db, LOOKUPS, 0),
    cache: stats(cache, dbQueries, hits),
    // Correctness check: a cache that returns the wrong answer fast is worse than no cache.
    sameAnswer: JSON.stringify(db.answer) === JSON.stringify(cache.answer),
  });
}
