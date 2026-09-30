"use client";

import { useMemo, useState } from "react";
import { formatBytes, utf8 } from "@/lib/encoding";
import { checkJson, formatJson } from "@/lib/json";
import CopyButton from "./CopyButton";

const STYLES = [
  ["2", "2 spaces", "  "],
  ["4", "4 spaces", "    "],
  ["tab", "Tabs", "\t"],
  ["min", "Minify", ""],
] as const;

const SAMPLE =
  '{"order_id":12345678901234567890,"status":"paid","items":[{"sku":"TSHIRT-M","qty":2,"price":499.00}],"customer":{"email":"dev@example.com","notes":null},"tags":[]}';

export default function JsonFormatter() {
  const [input, setInput] = useState("");
  const [style, setStyle] = useState<(typeof STYLES)[number][0]>("2");

  const result = useMemo(() => {
    if (!input.trim()) return null;
    const check = checkJson(input);
    if (!check.ok) return check;
    const indent = STYLES.find(([id]) => id === style)![2];
    const text = formatJson(input, indent);
    return { ok: true as const, text, before: utf8(input).length, after: utf8(text).length };
  }, [input, style]);

  return (
    <div className="panel">
      <div className="t-bar">
        <div className="chips" role="group" aria-label="Output style">
          {STYLES.map(([id, label]) => (
            <button key={id} type="button" className={style === id ? "chip on" : "chip"} onClick={() => setStyle(id)}>
              {label}
            </button>
          ))}
        </div>
        <div className="t-actions">
          <button type="button" className="btn small light" onClick={() => setInput(SAMPLE)}>
            Sample
          </button>
          <button type="button" className="btn small light" onClick={() => setInput("")} disabled={!input}>
            Clear
          </button>
        </div>
      </div>

      <div className="t-grid">
        <label className="t-field">
          <span className="t-label">Your JSON</span>
          <textarea
            className="t-area"
            name="json"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='{"paste": "JSON here"}'
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
        </label>
        <div className="t-field">
          <span className="t-label">
            Result
            {result?.ok && <CopyButton text={result.text} />}
          </span>
          <pre className="t-out" tabIndex={0}>
            {result?.ok ? result.text : ""}
          </pre>
        </div>
      </div>

      <p className="t-status" role="status">
        {!result && "Waiting for JSON."}
        {result?.ok && (
          <span className="good">
            Valid JSON. {formatBytes(result.before)} in, {formatBytes(result.after)} out.
          </span>
        )}
        {result && !result.ok && (
          <span className="bad">
            Not valid JSON{result.line ? ` at line ${result.line}, column ${result.column}` : ""}: {result.message}.
          </span>
        )}
      </p>
    </div>
  );
}
