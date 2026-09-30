// Small byte helpers for the tools. They use only what every browser has built in.

export const utf8 = (text: string) => new TextEncoder().encode(text);

/** Bytes to text, or null when the bytes are not valid UTF-8 text. */
export function bytesToText(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

export function bytesToBase64(bytes: Uint8Array, urlSafe = false): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const base64 = btoa(binary);
  return urlSafe ? base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : base64;
}

/** Reads standard or URL-safe Base64, with or without padding. Returns null when it is not Base64. */
export function base64ToBytes(text: string): Uint8Array | null {
  const clean = text.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  if (!/^[A-Za-z0-9+/]*$/.test(clean) || clean.length % 4 === 1) return null;
  const binary = atob(clean + "=".repeat((4 - (clean.length % 4)) % 4));
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
}

export const bytesToHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

export type HmacHash = "SHA-256" | "SHA-384" | "SHA-512";

/** HMAC of `data` with `secret`, computed by the browser's own crypto. */
export async function hmac(hash: HmacHash, secret: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", secret as BufferSource, { name: "HMAC", hash }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, data as BufferSource));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** "in 2 hours", "3 days ago". `from` and `to` are in milliseconds. */
export function relativeTime(to: number, from: number): string {
  const seconds = Math.round((to - from) / 1000);
  const abs = Math.abs(seconds);
  const units: [number, string][] = [[31_536_000, "year"], [2_592_000, "month"], [86_400, "day"], [3600, "hour"], [60, "minute"], [1, "second"]];
  if (abs < 5) return "just now";
  const [size, name] = units.find(([s]) => abs >= s) ?? units[units.length - 1];
  const n = Math.floor(abs / size);
  const text = `${n} ${name}${n === 1 ? "" : "s"}`;
  return seconds < 0 ? `${text} ago` : `in ${text}`;
}
