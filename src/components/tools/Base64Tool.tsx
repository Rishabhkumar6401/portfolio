"use client";

import { useMemo, useState } from "react";
import { base64ToBytes, bytesToBase64, bytesToHex, bytesToText, utf8 } from "@/lib/encoding";
import CopyButton from "./CopyButton";

type Mode = "encode" | "decode";

export default function Base64Tool() {
  const [mode, setMode] = useState<Mode>("encode");
  const [urlSafe, setUrlSafe] = useState(false);
  const [input, setInput] = useState("");

  const result = useMemo(() => {
    if (!input) return null;
    if (mode === "encode") return { ok: true as const, text: bytesToBase64(utf8(input), urlSafe), note: "" };

    const bytes = base64ToBytes(input);
    if (!bytes) return { ok: false as const, message: "This is not valid Base64. Check for missing or extra characters." };
    const text = bytesToText(bytes);
    if (text !== null) return { ok: true as const, text, note: "" };
    // Not text: show the first bytes as hex so the visitor can still recognise the data.
    const preview = bytesToHex(bytes.subarray(0, 48)).replace(/(..)/g, "$1 ").trim();
    return { ok: true as const, text: preview + (bytes.length > 48 ? " ..." : ""), note: `The result is binary data (${bytes.length} bytes), not text. Its first bytes are shown as hex.` };
  }, [input, mode, urlSafe]);

  // Use the result as the next input, going the other way.
  const swap = () => {
    if (result?.ok && !result.note) setInput(result.text);
    setMode(mode === "encode" ? "decode" : "encode");
  };

  return (
    <div className="panel">
      <div className="t-bar">
        <div className="chips" role="group" aria-label="Direction">
          <button type="button" className={mode === "encode" ? "chip on" : "chip"} onClick={() => setMode("encode")}>
            Encode
          </button>
          <button type="button" className={mode === "decode" ? "chip on" : "chip"} onClick={() => setMode("decode")}>
            Decode
          </button>
        </div>
        <div className="t-actions">
          {mode === "encode" && (
            <label className="t-check">
              <input type="checkbox" name="url-safe" checked={urlSafe} onChange={(e) => setUrlSafe(e.target.checked)} />
              URL-safe
            </label>
          )}
          <button type="button" className="btn small light" onClick={swap}>
            Swap
          </button>
          <button type="button" className="btn small light" onClick={() => setInput("")} disabled={!input}>
            Clear
          </button>
        </div>
      </div>

      <div className="t-grid">
        <label className="t-field">
          <span className="t-label">{mode === "encode" ? "Text" : "Base64"}</span>
          <textarea
            className="t-area"
            name="input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === "encode" ? "Type or paste text" : "Paste Base64"}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
        </label>
        <div className="t-field">
          <span className="t-label">
            {mode === "encode" ? "Base64" : "Text"}
            {result?.ok && <CopyButton text={result.text} />}
          </span>
          <pre className="t-out wrap" tabIndex={0}>
            {result?.ok ? result.text : ""}
          </pre>
        </div>
      </div>

      <p className="t-status" role="status">
        {!result && (mode === "encode" ? "Waiting for text." : "Waiting for Base64.")}
        {result?.ok && (result.note || `${utf8(input).length} bytes in, ${utf8(result.text).length} bytes out.`)}
        {result && !result.ok && <span className="bad">{result.message}</span>}
      </p>
    </div>
  );
}
