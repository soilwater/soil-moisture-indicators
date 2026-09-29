/**
 * csv.js — load and normalize CSV data (bundled samples or user uploads).
 *
 * Produces a column-oriented data object:
 *   { columns: Set<string>, timestamp: Date[], vwc: number[], precip: number[],
 *     soiltemp: number[], n: number, source: string }
 * Only columns actually present in the file are populated. Rows with an
 * unparseable timestamp are dropped; rows are sorted oldest -> newest.
 */

/** Split one CSV line into fields (handles simple double-quoted fields). */
function splitLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/**
 * Parse a timestamp string into a UTC Date. Accepts "YYYY-MM-DD",
 * "YYYY-MM-DD HH:MM[:SS]", the ISO "T" variant, and falls back to Date.parse.
 * Returns null if unparseable.
 */
export function parseTimestamp(s) {
  if (s == null) return null;
  const str = String(s).trim();
  if (!str) return null;
  const m = str.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (m) {
    const [, y, mo, d, hh = "0", mm = "0", ss = "0"] = m;
    return new Date(
      Date.UTC(+y, +mo - 1, +d, +hh, +mm, +ss)
    );
  }
  const t = Date.parse(str);
  return Number.isNaN(t) ? null : new Date(t);
}

/** Parse raw CSV text into the normalized data object. */
export function parseCsv(text, source = "data") {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error("CSV appears to be empty or has no data rows.");
  }
  const header = splitLine(lines[0]).map((h) => h.trim().toLowerCase());
  const tsIdx = header.indexOf("timestamp");
  if (tsIdx === -1) {
    throw new Error("CSV must have a 'timestamp' column.");
  }

  const numericCols = header.filter((h) => h !== "timestamp");
  const rows = [];
  for (let r = 1; r < lines.length; r++) {
    const cells = splitLine(lines[r]);
    const ts = parseTimestamp(cells[tsIdx]);
    if (!ts) continue; // drop rows with bad timestamps
    const row = { timestamp: ts };
    for (const col of numericCols) {
      const v = parseFloat(cells[header.indexOf(col)]);
      row[col] = Number.isFinite(v) ? v : NaN;
    }
    rows.push(row);
  }
  rows.sort((a, b) => a.timestamp - b.timestamp);

  const data = { columns: new Set(header), n: rows.length, source };
  data.timestamp = rows.map((r) => r.timestamp);
  for (const col of numericCols) data[col] = rows.map((r) => r[col]);
  return data;
}

/**
 * Aggregate any record to a continuous daily series: VWC as the daily mean,
 * precipitation as the daily total. Days with no VWC readings become NaN;
 * days with no precipitation readings count as 0 mm.
 */
export function toDaily(data) {
  const dayKey = (d) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const keys = data.timestamp.map(dayKey);
  if (!keys.length) return data;
  const first = keys[0];
  const last = keys[keys.length - 1];
  const nDays = Math.round((last - first) / 86400000) + 1;
  const out = { columns: data.columns, source: data.source, n: nDays };
  out.timestamp = Array.from({ length: nDays }, (_, i) => new Date(first + i * 86400000));
  for (const col of [...data.columns].filter((c) => c !== "timestamp")) {
    const sum = new Float64Array(nDays);
    const cnt = new Uint32Array(nDays);
    data[col].forEach((v, r) => {
      if (!Number.isFinite(v)) return;
      const k = Math.round((keys[r] - first) / 86400000);
      sum[k] += v;
      cnt[k]++;
    });
    out[col] = Array.from(sum, (s, k) => {
      if (col === "precip") return s; // daily total; empty day = 0 mm
      return cnt[k] ? s / cnt[k] : NaN; // daily mean
    });
  }
  out.subDaily = data.timestamp.length > nDays;
  return out;
}

/** Fetch and parse a bundled CSV by URL. */
export async function loadCsv(url, source) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status}).`);
  const text = await res.text();
  return parseCsv(text, source || url);
}
