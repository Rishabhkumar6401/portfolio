// Types and limits shared by the webhook tester's server code and its page.

export const HOOK_TTL_SECONDS = 24 * 60 * 60; // a test URL lives for one day
export const MAX_STORED_REQUESTS = 50; // older requests are dropped
export const MAX_BODY_BYTES = 16 * 1024; // larger bodies are cut here

/** The replies a test URL can be set to give. Error codes show how a sender retries. */
export const RESPONSE_STATUSES = [200, 201, 204, 400, 401, 403, 404, 500, 503] as const;
export type ResponseStatus = (typeof RESPONSE_STATUSES)[number];

/** One request received on a test URL, as stored. */
export type CapturedRequest = {
  at: number; // when it arrived, in milliseconds
  method: string;
  path: string; // anything after the test URL, e.g. "/orders"
  query: string; // the raw query string, without "?"
  ip: string;
  headers: [string, string][];
  body: string;
  bodyEncoding: "utf8" | "base64"; // base64 when the body is not text
  bodyBytes: number; // the full size, even when the stored body was cut
  truncated: boolean;
};

export type ListedRequest = CapturedRequest & { seq: number };
