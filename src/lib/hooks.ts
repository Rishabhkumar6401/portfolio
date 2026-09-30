import { createHash, randomBytes } from "node:crypto";
import { redis } from "./redis";
import {
  HOOK_TTL_SECONDS,
  MAX_BODY_BYTES,
  MAX_STORED_REQUESTS,
  type CapturedRequest,
  type ListedRequest,
  type ResponseStatus,
} from "./hookShared";
import { clientIp } from "./request";

/*
 * Storage for the webhook tester. Everything lives in Redis and expires by itself after a day:
 *
 *   hook:<id>            the test URL: a hash of its view key, a request counter, the reply status
 *   hook:<id>:requests   the newest requests, newest first
 *
 * Each operation is one Lua script, so its checks and writes happen as a single step. Two requests
 * arriving together can never both slip past a limit or leave the counter and the list out of step.
 *
 * A test URL has two secrets. Its id is in the URL that gets pasted into other services, and can only
 * add requests. Reading them needs the view key, which stays in the visitor's browser. Only a hash of
 * that key is stored here.
 */

const CAPTURES_PER_MINUTE = 60; // per test URL
const READS_PER_MINUTE = 120; // per visitor
const CREATES_PER_HOUR = 10; // per visitor
const CREATES_PER_DAY = 200; // everyone together, to stay inside the free Redis plan
const MAX_HEADERS = 40;
const MAX_HEADER_VALUE = 1024;

const ID_PATTERN = /^[A-Za-z0-9_-]{16}$/;
const KEY_PATTERN = /^[A-Za-z0-9_-]{22}$/;

export const isHookId = (id: string) => ID_PATTERN.test(id);
export const isViewKey = (key: string | null): key is string => Boolean(key && KEY_PATTERN.test(key));

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");
const hookKey = (id: string) => `hook:${id}`;
const listKey = (id: string) => `hook:${id}:requests`;

type Limited<Reason extends string> = { ok: false; reason: Reason; retryAfter: number };
type Missing<Reason extends string = "gone" | "forbidden"> = { ok: false; reason: Reason };

// KEYS: visitor counter, daily counter, test URL. ARGV: visitor limit, daily limit, key hash, expiry time, lifetime.
const CREATE = `
local mine = redis.call('INCR', KEYS[1])
if mine == 1 then redis.call('EXPIRE', KEYS[1], 3600) end
if mine > tonumber(ARGV[1]) then return {'visitor_limit', redis.call('TTL', KEYS[1])} end
local all = redis.call('INCR', KEYS[2])
if all == 1 then redis.call('EXPIRE', KEYS[2], 86400) end
if all > tonumber(ARGV[2]) then return {'daily_limit', redis.call('TTL', KEYS[2])} end
redis.call('HSET', KEYS[3], 'key', ARGV[3], 'seq', 0, 'status', 200, 'expires', ARGV[4])
redis.call('EXPIRE', KEYS[3], tonumber(ARGV[5]))
return {'ok', 0}`;

export async function createHook(visitor: string) {
  const id = randomBytes(12).toString("base64url");
  const key = randomBytes(16).toString("base64url");
  const expiresAt = Date.now() + HOOK_TTL_SECONDS * 1000;
  const [result, retryAfter] = await redis<[string, number]>([
    "EVAL", CREATE, 3, `hook:new:${visitor}`, "hook:new:day", hookKey(id),
    CREATES_PER_HOUR, CREATES_PER_DAY, sha256(key), expiresAt, HOOK_TTL_SECONDS,
  ]);
  if (result !== "ok") {
    return { ok: false, reason: result, retryAfter: Math.max(1, retryAfter) } as Limited<"visitor_limit" | "daily_limit">;
  }
  return { ok: true as const, id, key, expiresAt };
}

// KEYS: test URL, its requests, its rate counter. ARGV: the request, requests kept, requests allowed a minute.
const CAPTURE = `
local status = redis.call('HGET', KEYS[1], 'status')
if not status then return {'gone', 0} end
local hits = redis.call('INCR', KEYS[3])
if hits == 1 then redis.call('EXPIRE', KEYS[3], 60) end
if hits > tonumber(ARGV[3]) then return {'rate_limit', redis.call('TTL', KEYS[3])} end
redis.call('HINCRBY', KEYS[1], 'seq', 1)
redis.call('LPUSH', KEYS[2], ARGV[1])
redis.call('LTRIM', KEYS[2], 0, tonumber(ARGV[2]) - 1)
local left = redis.call('TTL', KEYS[1])
if left > 0 then redis.call('EXPIRE', KEYS[2], left) end
return {'ok', tonumber(status)}`;

/** Stores one incoming request and returns the status the test URL is set to reply with. */
export async function captureRequest(id: string, request: CapturedRequest) {
  const [result, value] = await redis<[string, number]>([
    "EVAL", CAPTURE, 3, hookKey(id), listKey(id), `hook:${id}:rate`,
    JSON.stringify(request), MAX_STORED_REQUESTS, CAPTURES_PER_MINUTE,
  ]);
  if (result === "gone") return { ok: false, reason: "gone" } as Missing<"gone">;
  if (result !== "ok") return { ok: false, reason: "rate_limit", retryAfter: Math.max(1, value) } as Limited<"rate_limit">;
  return { ok: true as const, status: value as ResponseStatus };
}

// KEYS: test URL, its requests, visitor's read counter. ARGV: key hash, last request seen, requests kept, reads allowed a minute.
const READ = `
local reads = redis.call('INCR', KEYS[3])
if reads == 1 then redis.call('EXPIRE', KEYS[3], 60) end
if reads > tonumber(ARGV[4]) then return {'rate_limit', redis.call('TTL', KEYS[3])} end
local meta = redis.call('HMGET', KEYS[1], 'key', 'seq', 'status', 'expires')
if not meta[1] then return {'gone'} end
if meta[1] ~= ARGV[1] then return {'forbidden'} end
local seq = tonumber(meta[2])
local fresh = math.min(seq - tonumber(ARGV[2]), tonumber(ARGV[3]))
local items = {}
if fresh > 0 then items = redis.call('LRANGE', KEYS[2], 0, fresh - 1) end
return {'ok', seq, tonumber(meta[3]), meta[4], items}`;

/** Returns the requests that arrived after request number `after`, newest first. */
export async function readRequests(id: string, key: string, after: number, visitor: string) {
  const [result, seq, status, expires, items] = await redis<[string, number, number, string, string[]]>([
    "EVAL", READ, 3, hookKey(id), listKey(id), `hook:read:${visitor}`,
    sha256(key), after, MAX_STORED_REQUESTS, READS_PER_MINUTE,
  ]);
  if (result === "rate_limit") return { ok: false, reason: "rate_limit", retryAfter: Math.max(1, seq) } as Limited<"rate_limit">;
  if (result !== "ok") return { ok: false, reason: result } as Missing;
  // The list is newest first and the counter goes up by one per request, so each position has a known number.
  const requests: ListedRequest[] = items.map((item, i) => ({ ...(JSON.parse(item) as CapturedRequest), seq: seq - i }));
  return { ok: true as const, seq, status: status as ResponseStatus, expiresAt: Number(expires), requests };
}

// KEYS: test URL. ARGV: key hash, new reply status.
const SET_STATUS = `
local stored = redis.call('HGET', KEYS[1], 'key')
if not stored then return 'gone' end
if stored ~= ARGV[1] then return 'forbidden' end
redis.call('HSET', KEYS[1], 'status', ARGV[2])
return 'ok'`;

export async function setReplyStatus(id: string, key: string, status: ResponseStatus) {
  const result = await redis<string>(["EVAL", SET_STATUS, 1, hookKey(id), sha256(key), status]);
  return result === "ok" ? { ok: true as const } : ({ ok: false, reason: result } as Missing);
}

// KEYS: test URL, its requests, its rate counter. ARGV: key hash.
const DELETE = `
local stored = redis.call('HGET', KEYS[1], 'key')
if not stored then return 'gone' end
if stored ~= ARGV[1] then return 'forbidden' end
redis.call('DEL', KEYS[1], KEYS[2], KEYS[3])
return 'ok'`;

export async function deleteHook(id: string, key: string) {
  const result = await redis<string>(["EVAL", DELETE, 3, hookKey(id), listKey(id), `hook:${id}:rate`, sha256(key)]);
  return result === "ok" ? { ok: true as const } : ({ ok: false, reason: result } as Missing);
}

// Headers added by the hosting platform on the way in. They say nothing about the sender, so they are left out.
const PLATFORM_HEADERS = /^(x-vercel-|x-forwarded-|x-middleware-|x-nextjs-|x-invoke-|x-real-ip$|x-matched-path$|forwarded$)/;

/** Reads the body up to the limit and stops there, so a huge upload cannot fill the store. */
async function readBody(req: Request) {
  const chunks: Uint8Array[] = [];
  let kept = 0;
  let truncated = false;
  const reader = req.body?.getReader();
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    const room = MAX_BODY_BYTES - kept;
    if (value.byteLength > room) {
      if (room > 0) chunks.push(value.subarray(0, room));
      kept = MAX_BODY_BYTES;
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(value);
    kept += value.byteLength;
  }
  const bytes = Buffer.concat(chunks);
  const declared = Number(req.headers.get("content-length"));
  return { bytes, truncated, size: truncated && declared > kept ? declared : kept };
}

/** Turns an incoming request into the record that is stored and shown. */
export async function describeRequest(req: Request, path: string[] | undefined): Promise<CapturedRequest> {
  const { bytes, truncated, size } = await readBody(req);

  // Keep text as text. Anything that is not valid UTF-8 (an image, a zip) is kept as base64.
  let body: string;
  let bodyEncoding: CapturedRequest["bodyEncoding"] = "utf8";
  try {
    // "stream" lets a body that was cut in the middle of a character still count as text. "ignoreBOM"
    // keeps a leading byte-order mark, so the text turns back into exactly the bytes that were sent.
    body = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes, { stream: truncated });
  } catch {
    body = bytes.toString("base64");
    bodyEncoding = "base64";
  }

  const headers: [string, string][] = [];
  req.headers.forEach((value, name) => {
    if (headers.length < MAX_HEADERS && !PLATFORM_HEADERS.test(name)) headers.push([name, value.slice(0, MAX_HEADER_VALUE)]);
  });

  return {
    at: Date.now(),
    method: req.method,
    path: path?.length ? `/${path.join("/")}`.slice(0, 500) : "",
    query: new URL(req.url).search.slice(1, 2001),
    ip: clientIp(req),
    headers,
    body,
    bodyEncoding,
    bodyBytes: size,
    truncated,
  };
}
