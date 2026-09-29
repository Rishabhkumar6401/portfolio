type RedisValue = string | number | null;

export function redisConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

/**
 * Runs one command on Upstash Redis over its REST API, e.g. redis(["GET", "key"]).
 * Deliberately no SDK: one command is exactly one HTTPS request, with no hidden retries
 * or automatic JSON parsing — so the caching demo times exactly what it says it does.
 */
export async function redis(command: (string | number)[]): Promise<RedisValue> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN");

  const res = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(3000),
  });
  const body = (await res.json().catch(() => ({}))) as { result?: RedisValue; error?: string };
  if (!res.ok || body.error) throw new Error(`Redis ${command[0]} failed: ${body.error ?? res.status}`);
  return body.result ?? null;
}
