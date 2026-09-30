"use client";

import { useMemo, useState } from "react";
import { relativeTime } from "@/lib/encoding";
import CopyButton from "./CopyButton";
import { useNow } from "./useNow";

const UNITS = [
  { name: "seconds", maxDigits: 11, perMs: 1 / 1000 },
  { name: "milliseconds", maxDigits: 14, perMs: 1 },
  { name: "microseconds", maxDigits: 17, perMs: 1000 },
  { name: "nanoseconds", maxDigits: 20, perMs: 1_000_000 },
];

const LOCAL = { dateStyle: "full", timeStyle: "long" } as const;

/** Works out the unit from the number of digits, then converts to a date. */
function readTimestamp(text: string) {
  const clean = text.trim().replace(/[,_\s]/g, "");
  if (!clean) return null;
  if (!/^-?\d+(\.\d+)?$/.test(clean)) return { ok: false as const, message: "A timestamp is a number, for example 1767225600." };
  const digits = clean.replace(/^-/, "").split(".")[0].length;
  const unit = UNITS.find((u) => digits <= u.maxDigits);
  if (!unit) return { ok: false as const, message: "That number is too long to be a timestamp." };
  const ms = Number(clean) / unit.perMs;
  if (Math.abs(ms) > 8.64e15) return { ok: false as const, message: "That date is outside the range a computer clock can show." };
  return { ok: true as const, ms, unit: unit.name };
}

export default function TimestampTool() {
  const now = useNow(1000);
  const [stamp, setStamp] = useState("");
  const [picked, setPicked] = useState("");
  const [pickedZone, setPickedZone] = useState<"local" | "utc">("local");

  const read = useMemo(() => readTimestamp(stamp), [stamp]);
  const pickedMs = useMemo(() => {
    if (!picked) return null;
    // The picker gives a time with no zone, such as 2026-01-01T09:30:00. Adding "Z" reads it as UTC.
    const ms = new Date(pickedZone === "utc" ? `${picked}Z` : picked).getTime();
    return Number.isNaN(ms) ? null : ms;
  }, [picked, pickedZone]);

  const nowSeconds = now === null ? "" : String(Math.floor(now / 1000));

  return (
    <div className="panel">
      <div className="t-now">
        <span className="t-label">Current Unix time</span>
        <b>{nowSeconds || " "}</b>
        <CopyButton text={nowSeconds} />
        <button type="button" className="btn small light" onClick={() => setStamp(nowSeconds)} disabled={!nowSeconds}>
          Use it below
        </button>
      </div>

      <div className="t-grid">
        <div className="t-field">
          <label className="t-label" htmlFor="stamp">
            Timestamp to date
          </label>
          <input
            id="stamp"
            name="timestamp"
            className="t-input"
            value={stamp}
            onChange={(e) => setStamp(e.target.value)}
            placeholder="1767225600"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
          />
          {read?.ok === false && <p className="t-status bad">{read.message}</p>}
          {read?.ok && (
            <dl className="t-rows">
              <div>
                <dt>Read as</dt>
                <dd>{read.unit}</dd>
              </div>
              <div>
                <dt>UTC</dt>
                <dd>
                  {new Date(read.ms).toISOString()}
                  <CopyButton text={new Date(read.ms).toISOString()} />
                </dd>
              </div>
              <div>
                <dt>Your time</dt>
                <dd>{new Date(read.ms).toLocaleString(undefined, LOCAL)}</dd>
              </div>
              {now !== null && (
                <div>
                  <dt>From now</dt>
                  <dd>{relativeTime(read.ms, now)}</dd>
                </div>
              )}
            </dl>
          )}
        </div>

        <div className="t-field">
          <label className="t-label" htmlFor="picked">
            Date to timestamp
          </label>
          <div className="t-inline">
            <input id="picked" name="date" className="t-input" type="datetime-local" step={1} value={picked} onChange={(e) => setPicked(e.target.value)} />
            <div className="chips" role="group" aria-label="Time zone of the date">
              <button type="button" className={pickedZone === "local" ? "chip on" : "chip"} onClick={() => setPickedZone("local")}>
                My time
              </button>
              <button type="button" className={pickedZone === "utc" ? "chip on" : "chip"} onClick={() => setPickedZone("utc")}>
                UTC
              </button>
            </div>
          </div>
          {pickedMs !== null && (
            <dl className="t-rows">
              <div>
                <dt>Seconds</dt>
                <dd>
                  {Math.floor(pickedMs / 1000)}
                  <CopyButton text={String(Math.floor(pickedMs / 1000))} />
                </dd>
              </div>
              <div>
                <dt>Milliseconds</dt>
                <dd>
                  {pickedMs}
                  <CopyButton text={String(pickedMs)} />
                </dd>
              </div>
              <div>
                <dt>UTC</dt>
                <dd>{new Date(pickedMs).toISOString()}</dd>
              </div>
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}
