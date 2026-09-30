"use client";

import { useMemo, useState } from "react";
import { describeCron, describeField, nextRuns, parseCron } from "@/lib/cron";
import { relativeTime } from "@/lib/encoding";
import { useNow } from "./useNow";

const EXAMPLES = ["*/15 9-17 * * 1-5", "0 0 * * *", "30 2 1 * *", "0 */6 * * *", "0 9 * * mon", "@hourly"];

const RUN_FORMAT = { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false } as const;

export default function CronTool() {
  const [text, setText] = useState(EXAMPLES[0]);
  const [zone, setZone] = useState<"local" | "utc">("local");
  const now = useNow(30_000);

  const parsed = useMemo(() => parseCron(text), [text]);
  const runs = useMemo(
    () => (parsed.ok && now !== null ? nextRuns(parsed.cron, new Date(now), 5, zone === "utc") : null),
    [parsed, now, zone],
  );

  return (
    <div className="panel">
      <label className="t-field">
        <span className="t-label">Cron expression</span>
        <input
          className="t-input big"
          name="cron"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="* * * * *"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
        />
      </label>
      <div className="chips wrap" role="group" aria-label="Examples">
        {EXAMPLES.map((example) => (
          <button key={example} type="button" className={text === example ? "chip on" : "chip"} onClick={() => setText(example)}>
            {example}
          </button>
        ))}
      </div>

      {!parsed.ok && (
        <p className="t-status bad" role="status">
          {parsed.message}
        </p>
      )}

      {parsed.ok && (
        <>
          <p className="t-answer" role="status">
            {describeCron(parsed.cron)}
          </p>

          <div className="t-grid">
            <div className="t-field">
              <span className="t-label">Field by field</span>
              <dl className="t-rows">
                {parsed.cron.fields.map((field, i) => (
                  <div key={field.label}>
                    <dt>
                      {field.label}
                      <code>{field.text}</code>
                    </dt>
                    <dd>{describeField(field, i)}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="t-field">
              <span className="t-label">
                Next runs
                <span className="chips" role="group" aria-label="Time zone">
                  <button type="button" className={zone === "local" ? "chip on" : "chip"} onClick={() => setZone("local")}>
                    My time
                  </button>
                  <button type="button" className={zone === "utc" ? "chip on" : "chip"} onClick={() => setZone("utc")}>
                    UTC
                  </button>
                </span>
              </span>
              {runs && runs.length === 0 && <p className="t-status bad">This schedule never runs. No date matches it.</p>}
              {runs && runs.length > 0 && now !== null && (
                <ol className="t-runs">
                  {runs.map((run) => (
                    <li key={run.getTime()}>
                      <span>{run.toLocaleString("en-GB", { ...RUN_FORMAT, timeZone: zone === "utc" ? "UTC" : undefined })}</span>
                      <small>{relativeTime(run.getTime(), now)}</small>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
