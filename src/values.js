// Recognise what a cell holds: a missing-value marker, a number, a date or a yes/no value.
// Each function returns null when the text isn't that kind of value, so nothing is guessed.

const MISSING = new Set(["n/a", "na", "null", "none", "nil", "-", "--", "?", "nan", "#n/a", "(blank)"]);

export function isMissingMarker(text) {
  return MISSING.has(text.trim().toLowerCase());
}

/**
 * Read a number written the way people type them in spreadsheets:
 * "1,234.50", "$1,234", "-12", "(450)" for a negative, "12.5%".
 * Commas must be thousands separators (1,234 not 1,2), and "." is the decimal point.
 */
export function parseNumber(text) {
  let s = text.trim().replace(/[\s ]/g, "");
  let negative = false;
  if (/^\(.+\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-") || s.startsWith("−")) {
    negative = !negative;
    s = s.slice(1);
  }
  const currency = /^[$€£¥]/.test(s);
  if (currency) s = s.slice(1);
  if (s.startsWith("-") && !negative) {
    negative = true; // "$-5"
    s = s.slice(1);
  }
  const percent = s.endsWith("%");
  if (percent) s = s.slice(0, -1);
  if (!/^(\d{1,3}(,\d{3})+|\d+)?(\.\d+)?$/.test(s) || s === "" || s === ".") return null;
  let value = Number(s.replace(/,/g, ""));
  if (percent) value /= 100;
  if (negative) value = -value;
  return { value: Number(value.toPrecision(15)), percent, currency, leadingZero: /^0\d/.test(s) };
}

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

function realDate(y, m, d) {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/**
 * Read the parts of a date. Numeric dates like 03/04/2024 are returned as { a, b, y } without
 * deciding which part is the month; the whole column decides that (see dateOrder).
 * Only four-digit years are accepted, because "1/2/24" could be 1924 or 2024.
 */
export function parseDateParts(text) {
  const s = text.trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return realDate(y, mo, d) ? { kind: "fixed", y, m: mo, d } : null;
  }
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return { kind: "numeric", a: Number(m[1]), b: Number(m[2]), y: Number(m[3]) };
  // "Jan 5, 2024", "January 5 2024", "5 Jan 2024", "5-Jan-2024"
  m = s.match(/^([A-Za-z]{3,9})\.?[\s-](\d{1,2}),?[\s-](\d{4})$/) ?? null;
  let month;
  let day;
  let year;
  if (m) [month, day, year] = [m[1], m[2], m[3]];
  else {
    m = s.match(/^(\d{1,2})[\s-]([A-Za-z]{3,9})\.?,?[\s-](\d{4})$/);
    if (m) [day, month, year] = [m[1], m[2], m[3]];
  }
  if (!month) return null;
  const mo = MONTHS[month.toLowerCase().slice(0, month.toLowerCase().startsWith("sept") ? 4 : 3)];
  if (!mo) return null;
  const [y, d] = [Number(year), Number(day)];
  return realDate(y, mo, d) ? { kind: "fixed", y, m: mo, d } : null;
}

/**
 * Decide whether a column's numeric dates are day-first or month-first.
 * A first part above 12 can only be a day, and a second part above 12 can only be a day.
 * Returns "dmy", "mdy", "ambiguous" (every date fits both) or "conflict" (some fit only one way
 * and some only the other).
 */
export function dateOrder(partsList) {
  const numeric = partsList.filter((p) => p?.kind === "numeric");
  const dayFirst = numeric.some((p) => p.a > 12);
  const monthFirst = numeric.some((p) => p.b > 12);
  if (dayFirst && monthFirst) return "conflict";
  if (dayFirst) return "dmy";
  if (monthFirst) return "mdy";
  return numeric.length ? "ambiguous" : "dmy"; // no numeric dates: the order doesn't matter
}

/** Turn date parts into YYYY-MM-DD, or null if they don't make a real date in that order. */
export function toIsoDate(parts, order) {
  if (!parts) return null;
  let { y, m, d } = parts;
  if (parts.kind === "numeric") {
    if (order === "dmy") [d, m] = [parts.a, parts.b];
    else if (order === "mdy") [m, d] = [parts.a, parts.b];
    else return null;
    if (!realDate(y, m, d)) return null;
  }
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const TRUE_WORDS = new Set(["yes", "y", "true", "t"]);
const FALSE_WORDS = new Set(["no", "n", "false", "f"]);

/** "Yes", "Y", "true" → TRUE; "No", "N", "false" → FALSE. Numbers aren't treated as yes/no. */
export function parseBoolean(text) {
  const s = text.trim().toLowerCase();
  if (TRUE_WORDS.has(s)) return "TRUE";
  if (FALSE_WORDS.has(s)) return "FALSE";
  return null;
}
