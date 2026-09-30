// Reads a standard five-field cron expression: describes it in words and works out when it runs next.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type FieldRule = { label: string; min: number; max: number; names: string[] | null };

const FIELDS: FieldRule[] = [
  { label: "Minute", min: 0, max: 59, names: null },
  { label: "Hour", min: 0, max: 23, names: null },
  { label: "Day of month", min: 1, max: 31, names: null },
  { label: "Month", min: 1, max: 12, names: MONTHS },
  { label: "Day of week", min: 0, max: 7, names: DAYS }, // 0 and 7 are both Sunday
];

const MACROS: Record<string, string> = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};

type Part = { star: boolean; from: number; to: number; step: number };
export type CronField = { label: string; text: string; parts: Part[]; values: number[] };
export type Cron = { fields: [CronField, CronField, CronField, CronField, CronField] };
export type CronResult = { ok: true; cron: Cron } | { ok: false; message: string };

class CronError extends Error {}

function parseValue(token: string, field: FieldRule): number {
  let value = Number(token);
  if (field.names && /^[a-z]{3}$/i.test(token)) {
    const index = field.names.findIndex((name) => name.slice(0, 3).toLowerCase() === token.toLowerCase());
    if (index < 0) throw new CronError(`${field.label}: "${token}" is not a name I know.`);
    value = index + field.min;
  } else if (!/^\d+$/.test(token)) {
    throw new CronError(`${field.label}: "${token}" is not a number.`);
  }
  if (value < field.min || value > field.max) {
    throw new CronError(`${field.label} must be between ${field.min} and ${field.max}, but found ${value}.`);
  }
  return value;
}

function parseField(text: string, index: number): CronField {
  const field = FIELDS[index];
  const parts: Part[] = [];
  const values = new Set<number>();

  for (const piece of text.split(",")) {
    const [range, stepText, extra] = piece.split("/");
    if (!range || extra !== undefined || stepText === "") throw new CronError(`${field.label}: "${piece}" is not valid.`);
    const step = stepText === undefined ? 1 : Number(stepText);
    if (!Number.isInteger(step) || step < 1) throw new CronError(`${field.label}: the step in "${piece}" must be 1 or more.`);

    const star = range === "*";
    let from = field.min;
    let to = index === 4 ? 6 : field.max; // a star over the week covers Sunday to Saturday once
    if (!star) {
      const [a, b, more] = range.split("-");
      if (more !== undefined || a === "" || b === "") throw new CronError(`${field.label}: "${piece}" is not valid.`);
      from = parseValue(a, field);
      // "5/10" means "from 5 to the end, every 10".
      to = b !== undefined ? parseValue(b, field) : stepText !== undefined ? field.max : from;
      if (from > to) throw new CronError(`${field.label}: the range "${range}" goes backwards.`);
    }
    parts.push({ star, from, to, step });
    for (let v = from; v <= to; v += step) values.add(index === 4 ? v % 7 : v);
  }

  return { label: field.label, text, parts, values: [...values].sort((a, b) => a - b) };
}

export function parseCron(input: string): CronResult {
  const text = input.trim();
  if (!text) return { ok: false, message: "Type a cron expression, for example */15 9-17 * * 1-5." };
  if (text.toLowerCase() === "@reboot") return { ok: false, message: "@reboot runs once when the machine starts, so it has no schedule." };

  const expanded = MACROS[text.toLowerCase()] ?? text;
  const tokens = expanded.split(/\s+/);
  if (tokens.length !== 5) {
    const hint = tokens.length === 6 ? " This tool reads the standard format, which has no seconds field." : "";
    return { ok: false, message: `A cron expression has 5 fields, but this one has ${tokens.length}.${hint}` };
  }
  try {
    const fields = tokens.map(parseField) as Cron["fields"];
    return { ok: true, cron: { fields } };
  } catch (err) {
    if (err instanceof CronError) return { ok: false, message: err.message };
    throw err;
  }
}

// ---------------------------------------------------------------------------------------------
// Words

const two = (n: number) => String(n).padStart(2, "0");
const plural = (n: number, word: string) => (n === 1 ? word : `${n} ${word}s`);

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

function join(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const isStar = (field: CronField) => field.text === "*";
const only = (field: CronField) => (field.parts.length === 1 ? field.parts[0] : null);
const isSingle = (part: Part) => !part.star && part.from === part.to;

function timePhrase(minute: CronField, hour: CronField): string {
  // A handful of exact times reads best as a list of clock times.
  const exact = !minute.parts.some((p) => p.star) && !hour.parts.some((p) => p.star);
  if (exact && minute.values.length * hour.values.length <= 6) {
    return `At ${join(hour.values.flatMap((h) => minute.values.map((m) => `${two(h)}:${two(m)}`)))}`;
  }

  const m = only(minute);
  let minutes: string;
  if (isStar(minute)) minutes = "Every minute";
  else if (m?.star) minutes = `Every ${plural(m.step, "minute")}`;
  else if (m && isSingle(m)) minutes = `At minute ${m.from}`;
  else if (m) minutes = `Every ${plural(m.step, "minute")} from minute ${m.from} through ${m.to}`;
  else minutes = `At minutes ${join(minute.values.map(String))}`;

  const h = only(hour);
  const atMinute = minutes.startsWith("At");
  if (isStar(hour)) return atMinute ? `${minutes} of every hour` : minutes;
  if (h?.star) return atMinute ? `${minutes} of every ${ordinal(h.step)} hour` : `${minutes}, during every ${ordinal(h.step)} hour`;
  if (h) {
    const every = h.step > 1 ? `every ${plural(h.step, "hour")} ` : "";
    return `${minutes}, ${every}between ${two(h.from)}:00 and ${two(h.to)}:59`;
  }
  return `${minutes}, during hours ${join(hour.values.map(String))}`;
}

function monthDayPhrase(field: CronField): string {
  const p = only(field);
  if (p?.star) return `on every ${ordinal(p.step)} day of the month`;
  if (p && isSingle(p)) return `on day ${p.from} of the month`;
  if (p && p.step === 1) return `on days ${p.from} through ${p.to} of the month`;
  return `on days ${join(field.values.map(String))} of the month`;
}

function weekDayPhrase(field: CronField): string {
  const p = only(field);
  if (p?.star) return `on every ${ordinal(p.step)} day of the week`;
  if (p && p.step === 1 && p.from !== p.to) return `on ${DAYS[p.from % 7]} through ${DAYS[p.to % 7]}`;
  return `on ${join(field.values.map((d) => DAYS[d]))}`;
}

function monthPhrase(field: CronField): string {
  const p = only(field);
  if (p?.star) return `in every ${ordinal(p.step)} month`;
  if (p && p.step === 1 && p.from !== p.to) return `from ${MONTHS[p.from - 1]} through ${MONTHS[p.to - 1]}`;
  return `in ${join(field.values.map((m) => MONTHS[m - 1]))}`;
}

/** True when a run needs both day fields to match. Otherwise a match on either one is enough. */
function daysCombineWithAnd(cron: Cron): boolean {
  // Cron's own rule: the two day fields are joined with "or" unless one of them begins with a star.
  return cron.fields[2].text.startsWith("*") || cron.fields[4].text.startsWith("*");
}

/** The whole schedule as one sentence. */
export function describeCron(cron: Cron): string {
  const [minute, hour, monthDay, month, weekDay] = cron.fields;
  let sentence = timePhrase(minute, hour);

  if (isStar(monthDay) && isStar(weekDay)) {
    if (/^At \d\d:/.test(sentence)) sentence += " every day";
  } else if (isStar(monthDay)) sentence += ` ${weekDayPhrase(weekDay)}`;
  else if (isStar(weekDay)) sentence += ` ${monthDayPhrase(monthDay)}`;
  else if (daysCombineWithAnd(cron)) sentence += ` ${monthDayPhrase(monthDay)}, but only ${weekDayPhrase(weekDay)}`;
  else sentence += ` ${monthDayPhrase(monthDay)}, and also ${weekDayPhrase(weekDay)}`;

  if (!isStar(month)) sentence += ` ${monthPhrase(month)}`;
  return `${sentence}.`;
}

/** One field in words, for the field-by-field table. */
export function describeField(field: CronField, index: number): string {
  const unit = ["minute", "hour", "day", "month", "day of the week"][index];
  if (isStar(field)) return `every ${unit}`;
  const name = (v: number) => (index === 3 ? MONTHS[v - 1] : index === 4 ? DAYS[v] : String(v));
  const shown = field.values.length <= 12 ? join(field.values.map(name)) : `${field.values.length} values from ${name(field.values[0])} to ${name(field.values[field.values.length - 1])}`;
  const p = only(field);
  return p && p.step > 1 ? `every ${ordinal(p.step)} ${unit}: ${shown}` : shown;
}

// ---------------------------------------------------------------------------------------------
// Next runs

const SEARCH_YEARS = 8; // far enough to reach the next 29 February from any date

/** The next `count` times the schedule runs after `from`, in UTC or in the device's time zone. */
export function nextRuns(cron: Cron, from: Date, count: number, utc: boolean): Date[] {
  const [minutes, hours, monthDays, months, weekDays] = cron.fields.map((f) => new Set(f.values));
  const needBoth = daysCombineWithAnd(cron);
  const get = {
    minute: (d: Date) => (utc ? d.getUTCMinutes() : d.getMinutes()),
    hour: (d: Date) => (utc ? d.getUTCHours() : d.getHours()),
    day: (d: Date) => (utc ? d.getUTCDate() : d.getDate()),
    month: (d: Date) => (utc ? d.getUTCMonth() : d.getMonth()) + 1,
    weekDay: (d: Date) => (utc ? d.getUTCDay() : d.getDay()),
    year: (d: Date) => (utc ? d.getUTCFullYear() : d.getFullYear()),
  };
  // Jump to the start of a later month, day or hour.
  const moveTo = (d: Date, year: number, month: number, day: number, hour: number) => {
    if (utc) d.setTime(Date.UTC(year, month - 1, day, hour, 0, 0, 0));
    else d.setTime(new Date(year, month - 1, day, hour, 0, 0, 0).getTime());
  };
  const dayMatches = (d: Date) => {
    const byDate = monthDays.has(get.day(d));
    const byWeek = weekDays.has(get.weekDay(d));
    return needBoth ? byDate && byWeek : byDate || byWeek;
  };

  const runs: Date[] = [];
  const d = new Date(from.getTime());
  d.setSeconds(0, 0);
  d.setTime(d.getTime() + 60_000);
  const limit = from.getTime() + SEARCH_YEARS * 366 * 86_400_000;

  while (runs.length < count && d.getTime() < limit) {
    const before = d.getTime();
    if (!months.has(get.month(d))) moveTo(d, get.year(d), get.month(d) + 1, 1, 0);
    else if (!dayMatches(d)) moveTo(d, get.year(d), get.month(d), get.day(d) + 1, 0);
    else if (!hours.has(get.hour(d))) moveTo(d, get.year(d), get.month(d), get.day(d), get.hour(d) + 1);
    else {
      if (minutes.has(get.minute(d))) runs.push(new Date(d.getTime()));
      d.setTime(d.getTime() + 60_000);
    }
    // A clock change can make a jump land on or before where it started. Never go backwards.
    if (d.getTime() <= before) d.setTime(before + 60_000);
  }
  return runs;
}
