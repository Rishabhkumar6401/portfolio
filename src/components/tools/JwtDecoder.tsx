"use client";

import { useEffect, useMemo, useState } from "react";
import { base64ToBytes, bytesToBase64, bytesToText, hmac, relativeTime, utf8, type HmacHash } from "@/lib/encoding";
import CopyButton from "./CopyButton";
import { useNow } from "./useNow";

const HMAC_ALGORITHMS: Record<string, HmacHash> = { HS256: "SHA-256", HS384: "SHA-384", HS512: "SHA-512" };

const CLAIMS: Record<string, string> = {
  iss: "Issuer",
  sub: "Subject",
  aud: "Audience",
  exp: "Expires at",
  nbf: "Not valid before",
  iat: "Issued at",
  jti: "Token ID",
};
const TIME_CLAIMS = ["exp", "nbf", "iat"];

type Json = Record<string, unknown>;

function decodePart(part: string, name: string): { ok: true; value: Json } | { ok: false; message: string } {
  const bytes = base64ToBytes(part);
  const text = bytes && bytesToText(bytes);
  if (!text) return { ok: false, message: `The ${name} is not valid Base64URL text.` };
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("not an object");
    return { ok: true, value: value as Json };
  } catch {
    return { ok: false, message: `The ${name} is not a JSON object.` };
  }
}

function decodeToken(input: string) {
  const token = input.trim().replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) {
    return { ok: false as const, message: `A JWT has 3 parts separated by dots. This text has ${parts.length}.` };
  }
  const header = decodePart(parts[0], "header");
  if (!header.ok) return { ok: false as const, message: header.message };
  const payload = decodePart(parts[1], "payload");
  if (!payload.ok) return { ok: false as const, message: payload.message };
  return { ok: true as const, header: header.value, payload: payload.value, signed: `${parts[0]}.${parts[1]}`, signature: parts[2] };
}

/** A fresh token signed with "demo-secret", so the expiry and signature checks have something to show. */
async function makeSample(): Promise<string> {
  const part = (value: object) => bytesToBase64(utf8(JSON.stringify(value)), true);
  const issued = Math.floor(Date.now() / 1000);
  const signed = `${part({ alg: "HS256", typ: "JWT" })}.${part({ sub: "user_42", name: "Test User", role: "admin", iat: issued, exp: issued + 3600 })}`;
  return `${signed}.${bytesToBase64(await hmac("SHA-256", utf8("demo-secret"), utf8(signed)), true)}`;
}

export default function JwtDecoder() {
  const [input, setInput] = useState("");
  const [secret, setSecret] = useState("");
  const [checked, setChecked] = useState<{ for: string; valid: boolean } | null>(null);
  const now = useNow(1000);

  const token = useMemo(() => decodeToken(input), [input]);
  const algorithm = token?.ok && typeof token.header.alg === "string" ? token.header.alg : null;
  const hash = algorithm ? HMAC_ALGORITHMS[algorithm] : undefined;

  // The signature check is asynchronous, so its answer is stored with the inputs it belongs to.
  const checkFor = token?.ok && hash && secret ? `${input}\n${secret}` : null;
  useEffect(() => {
    if (!checkFor || !token?.ok || !hash) return;
    let cancelled = false;
    hmac(hash, utf8(secret), utf8(token.signed)).then((mac) => {
      if (!cancelled) setChecked({ for: checkFor, valid: bytesToBase64(mac, true) === token.signature.replace(/=+$/, "") });
    });
    return () => {
      cancelled = true;
    };
  }, [checkFor, token, hash, secret]);
  const verdict = checkFor && checked?.for === checkFor ? checked.valid : null;

  const loadSample = async () => {
    setInput(await makeSample());
    setSecret("demo-secret");
  };

  const expiry = (() => {
    if (!token?.ok || now === null) return null;
    const { exp, nbf } = token.payload;
    if (typeof nbf === "number" && nbf * 1000 > now) return { bad: true, text: `Not valid yet. It starts ${relativeTime(nbf * 1000, now)}.` };
    if (typeof exp !== "number") return { bad: false, text: "This token has no expiry time." };
    return exp * 1000 <= now
      ? { bad: true, text: `Expired ${relativeTime(exp * 1000, now)}.` }
      : { bad: false, text: `Expires ${relativeTime(exp * 1000, now)}.` };
  })();

  return (
    <div className="panel">
      <div className="t-bar">
        <span className="t-label">Token</span>
        <div className="t-actions">
          <button type="button" className="btn small light" onClick={loadSample}>
            Sample
          </button>
          <button type="button" className="btn small light" onClick={() => setInput("")} disabled={!input}>
            Clear
          </button>
        </div>
      </div>
      <textarea
        className="t-area short"
        aria-label="Token"
        name="token"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
      />

      {token?.ok === false && (
        <p className="t-status bad" role="status">
          {token.message}
        </p>
      )}

      {token?.ok && (
        <>
          <p className="t-status" role="status">
            {expiry && <span className={expiry.bad ? "bad" : "good"}>{expiry.text}</span>}
            {algorithm === "none" && <span className="bad"> This token is not signed (alg is none). Never accept it.</span>}
          </p>

          <div className="t-grid">
            <div className="t-field">
              <span className="t-label">
                Header
                <CopyButton text={JSON.stringify(token.header, null, 2)} />
              </span>
              <pre className="t-out auto">{JSON.stringify(token.header, null, 2)}</pre>

              <span className="t-label">Signature</span>
              {hash ? (
                <>
                  <input
                    className="t-input"
                    aria-label="Secret"
                    name="secret"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    placeholder={`Secret used to sign (${algorithm})`}
                    spellCheck={false}
                    autoComplete="off"
                  />
                  <p className="t-status">
                    {verdict === null && "Enter the secret to check the signature."}
                    {verdict === true && <span className="good">The signature is valid for this secret.</span>}
                    {verdict === false && <span className="bad">The signature does not match this secret.</span>}
                  </p>
                </>
              ) : (
                <p className="t-status">
                  {algorithm
                    ? `This token uses ${algorithm}. It is decoded here but not verified. Only HS256, HS384 and HS512 can be checked.`
                    : "The header does not name an algorithm."}
                </p>
              )}
            </div>

            <div className="t-field">
              <span className="t-label">
                Payload
                <CopyButton text={JSON.stringify(token.payload, null, 2)} />
              </span>
              <pre className="t-out auto">{JSON.stringify(token.payload, null, 2)}</pre>

              <dl className="t-rows">
                {Object.entries(token.payload)
                  .filter(([name]) => name in CLAIMS)
                  .map(([name, value]) => (
                    <div key={name}>
                      <dt>
                        {CLAIMS[name]}
                        <code>{name}</code>
                      </dt>
                      <dd>
                        {TIME_CLAIMS.includes(name) && typeof value === "number"
                          ? new Date(value * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "long" })
                          : typeof value === "string"
                            ? value
                            : JSON.stringify(value)}
                      </dd>
                    </div>
                  ))}
              </dl>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
