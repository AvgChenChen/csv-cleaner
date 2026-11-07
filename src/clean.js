// Clean a table, one step at a time, recording what each step changed.
//
// The first row is the header. Row numbers in the report are the line numbers a spreadsheet would
// show for the original file (the header is row 1), so a reader can find each problem.

import { dateOrder, isMissingMarker, parseBoolean, parseDateParts, parseNumber, toIsoDate } from "./values.js";

export const DEFAULTS = {
  trim: true,
  missing: true,
  dropEmptyRows: true,
  dropEmptyColumns: true,
  convert: true,
  dropDuplicates: true,
  threshold: 0.8, // share of a column's values that must parse before the column is converted
};

const MAX_EXAMPLES = 50; // per issue list, to keep the report readable

/** @param {string[][]} input rows from csv.parse */
export function clean(input, options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const steps = [];
  const issues = [];
  const step = (label, count, detail = "") => steps.push({ label, count, detail });

  const firstRow = input.findIndex((r) => r.some((v) => v.trim() !== ""));
  if (firstRow === -1) return { header: [], rows: [], columns: [], steps, issues, before: { rows: 0, columns: 0 } };

  let header = input[firstRow].slice();
  let rows = input.slice(firstRow + 1).map((values, i) => ({ line: firstRow + i + 2, values: values.slice() }));
  const before = { rows: rows.length, columns: header.length };
  if (firstRow > 0) step("Blank lines above the header removed", firstRow);

  // Header names: trimmed, blanks named, duplicates numbered.
  const seen = new Set();
  const reserved = new Set(header.map((raw, i) => (raw.trim().replace(/\s+/g, " ") || `column_${i + 1}`).toLowerCase()));
  const uniqueName = (base) => {
    let candidate = base;
    let suffix = 2;
    while (seen.has(candidate.toLowerCase())) {
      do candidate = `${base} (${suffix++})`;
      while (reserved.has(candidate.toLowerCase()));
    }
    seen.add(candidate.toLowerCase());
    return candidate;
  };
  let renamed = 0;
  header = header.map((raw, i) => {
    const name = uniqueName(raw.trim().replace(/\s+/g, " ") || `column_${i + 1}`);
    if (name !== raw) renamed += 1;
    return name;
  });
  step("Column names tidied (spaces, blank or repeated names)", renamed);

  // Rows with the wrong number of fields.
  let padded = 0;
  let trailing = 0;
  for (const row of rows) {
    if (row.values.length < header.length) {
      if (row.values.some((v) => v.trim() !== "")) padded += 1;
      while (row.values.length < header.length) row.values.push("");
    }
    while (row.values.length > header.length && row.values.at(-1).trim() === "") {
      row.values.pop();
      trailing += 1;
    }
  }
  const widest = Math.max(header.length, ...rows.map((r) => r.values.length));
  if (widest > header.length) {
    const extra = rows.filter((r) => r.values.length > header.length);
    for (let i = header.length; i < widest; i += 1) header.push(uniqueName(`extra_${i - before.columns + 1}`));
    for (const row of rows) while (row.values.length < widest) row.values.push("");
    for (const row of extra.slice(0, MAX_EXAMPLES))
      issues.push({ line: row.line, message: `Has more values than there are column names; the extra ones are kept in new "extra" columns.` });
    step("Rows with extra values (kept in new columns)", extra.length);
  }
  step("Short rows filled out with empty cells", padded);
  if (trailing) step("Stray empty fields at the end of rows removed", trailing);

  if (opts.trim) {
    let changed = 0;
    for (const row of rows)
      row.values = row.values.map((v) => {
        const t = v.replace(/ /g, " ").trim().replace(/[ \t]{2,}/g, " ");
        if (t !== v) changed += 1;
        return t;
      });
    step("Cells with extra spaces trimmed", changed);
  }

  if (opts.missing) {
    let changed = 0;
    for (const row of rows)
      row.values = row.values.map((v) => {
        if (v !== "" && isMissingMarker(v)) {
          changed += 1;
          return "";
        }
        return v;
      });
    step('Placeholders like "N/A", "null" or "-" made blank', changed);
  }

  if (opts.dropEmptyRows) {
    const kept = rows.filter((r) => r.values.some((v) => v !== ""));
    step("Empty rows removed", rows.length - kept.length);
    rows = kept;
  }

  if (opts.dropEmptyColumns) {
    const keep = header.map((_, c) => rows.some((r) => r.values[c] !== ""));
    const dropped = header.filter((_, c) => !keep[c]);
    header = header.filter((_, c) => keep[c]);
    for (const row of rows) row.values = row.values.filter((_, c) => keep[c]);
    step("Empty columns removed", dropped.length, dropped.join(", "));
  }

  const columns = header.map((name, c) => describeColumn(name, rows.map((r) => r.values[c]), opts));
  if (opts.convert) {
    let converted = 0;
    columns.forEach((col, c) => {
      if (!col.convert) return;
      for (const row of rows) {
        const value = row.values[c];
        if (value === "") continue;
        const out = col.convert(value);
        if (out === null) {
          col.failed.push({ line: row.line, value });
          if (col.failed.length <= MAX_EXAMPLES)
            issues.push({ line: row.line, message: `"${value}" in ${name(col)} couldn't be read as ${article(col.type)}; left as it was.` });
        } else if (out !== value) {
          row.values[c] = out;
          converted += 1;
          col.converted += 1;
        }
      }
    });
    step("Values written in one consistent format (numbers, dates, yes/no)", converted);
  }

  if (opts.dropDuplicates) {
    const seenRows = new Map();
    const kept = [];
    let duplicates = 0;
    for (const row of rows) {
      const key = JSON.stringify(row.values);
      if (seenRows.has(key)) {
        duplicates += 1;
        if (duplicates <= MAX_EXAMPLES)
          issues.push({ line: row.line, message: `Exact copy of row ${seenRows.get(key)}; removed.` });
      } else {
        seenRows.set(key, row.line);
        kept.push(row);
      }
    }
    step("Exact duplicate rows removed", duplicates);
    rows = kept;
  }

  issues.sort((x, y) => x.line - y.line);
  return {
    header,
    rows: rows.map((r) => r.values),
    lines: rows.map((r) => r.line),
    columns: columns.map(({ convert, ...rest }) => rest),
    steps,
    issues,
    before,
    after: { rows: rows.length, columns: header.length },
  };
}

const name = (col) => `"${col.name}"`;
const article = (type) => ({ number: "a number", date: "a date", "yes/no": "yes or no" })[type] ?? type;

/** Work out what a column holds, and how (if at all) to convert it. */
export function describeColumn(columnName, values, opts = DEFAULTS) {
  const filled = values.filter((v) => v !== "");
  const col = { name: columnName, type: "text", filled: filled.length, converted: 0, failed: [], note: "" };
  if (!filled.length) return col;
  const share = (n) => n / filled.length;

  const booleans = filled.map(parseBoolean);
  if (share(booleans.filter((b) => b !== null).length) >= opts.threshold) {
    return { ...col, type: "yes/no", note: "Written as TRUE or FALSE.", convert: parseBoolean };
  }

  const numbers = filled.map(parseNumber);
  const numeric = numbers.filter(Boolean);
  if (share(numeric.length) >= opts.threshold) {
    if (numeric.some((n) => n.leadingZero)) {
      return { ...col, note: "Looks like codes with leading zeros (such as postal or account codes), so kept as text." };
    }
    const notes = [];
    if (numeric.some((n) => n.currency)) notes.push("currency symbols and thousands separators removed");
    if (numeric.some((n) => n.percent)) notes.push("percentages written as decimals (12% → 0.12)");
    if (numeric.some((n) => n.value < 0) && filled.some((v) => v.trim().startsWith("(")))
      notes.push("amounts in brackets written as negatives");
    return {
      ...col,
      type: "number",
      note: notes.length ? `${capitalise(notes.join("; "))}.` : "",
      convert: (v) => parseNumber(v)?.value.toString() ?? null,
    };
  }

  const parts = filled.map(parseDateParts);
  if (share(parts.filter(Boolean).length) >= opts.threshold) {
    const order = dateOrder(parts);
    if (order === "ambiguous" || order === "conflict") {
      const why =
        order === "ambiguous"
          ? "Every date fits both day-first and month-first (03/04/2024 could be March 4 or April 3), so dates were left as they were."
          : "Some dates only make sense day-first and others only month-first, so dates were left as they were.";
      return { ...col, type: "date (unclear)", note: why };
    }
    const readable = parts.some((p) => p?.kind === "numeric")
      ? ` Read as ${order === "dmy" ? "day/month/year" : "month/day/year"}.`
      : "";
    return {
      ...col,
      type: "date",
      note: `Written as YYYY-MM-DD.${readable}`,
      convert: (v) => toIsoDate(parseDateParts(v), order),
    };
  }
  return col;
}

function capitalise(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
