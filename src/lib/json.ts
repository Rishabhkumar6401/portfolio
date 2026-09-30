// JSON formatting that copies every value exactly as written. It never turns the text into JavaScript
// values, so a large number such as 12345678901234567890 is not rounded.

export type JsonCheck = { ok: true } | { ok: false; message: string; line: number | null; column: number | null };

/** Says whether the text is valid JSON and, if not, where it breaks. */
export function checkJson(text: string): JsonCheck {
  try {
    JSON.parse(text);
    return { ok: true };
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Invalid JSON";
    // Browsers word this differently. Some give a position, some a line and column, some both.
    const lineColumn = /line (\d+) column (\d+)/.exec(raw);
    const position = /position (\d+)/.exec(raw);
    let line: number | null = null;
    let column: number | null = null;
    if (lineColumn) {
      line = Number(lineColumn[1]);
      column = Number(lineColumn[2]);
    } else if (position) {
      const before = text.slice(0, Number(position[1]));
      line = before.split("\n").length;
      column = before.length - before.lastIndexOf("\n");
    }
    const message = raw.replace(/^JSON\.parse: /, "").replace(/ in JSON at position \d+.*$/, "").replace(/ at line \d+ column \d+.*$/, "");
    return { ok: false, message, line, column };
  }
}

/**
 * Rewrites valid JSON with the given indentation, or on one line when `indent` is empty.
 * Call checkJson first: this walks the text and trusts it to be valid.
 */
export function formatJson(text: string, indent: string): string {
  const pretty = indent !== "";
  let out = "";
  let depth = 0;
  const newline = () => (pretty ? "\n" + indent.repeat(depth) : "");

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      // Copy a whole string, skipping over escaped characters so an escaped quote does not end it.
      let end = i + 1;
      while (text[end] !== '"') end += text[end] === "\\" ? 2 : 1;
      out += text.slice(i, end + 1);
      i = end;
    } else if (ch === "{" || ch === "[") {
      // Look ahead: an empty object or array stays on one line.
      let next = i + 1;
      while (/\s/.test(text[next])) next++;
      if (text[next] === "}" || text[next] === "]") {
        out += ch + text[next];
        i = next;
      } else {
        depth++;
        out += ch + newline();
      }
    } else if (ch === "}" || ch === "]") {
      depth--;
      out += newline() + ch;
    } else if (ch === ",") {
      out += ch + newline();
    } else if (ch === ":") {
      out += pretty ? ": " : ":";
    } else if (!/\s/.test(ch)) {
      out += ch; // part of a number, true, false or null
    }
  }
  return out;
}
