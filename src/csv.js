// Read and write CSV text, following the common rules (RFC 4180):
// - fields are separated by a delimiter, rows by a newline (\n or \r\n),
// - a field in double quotes can contain the delimiter, newlines and "" for a literal quote.

const DELIMITERS = [",", ";", "\t", "|"];

/** Guess the delimiter: the candidate that splits the first few lines most consistently. */
export function detectDelimiter(text) {
  const lines = sampleRecords(text);
  let best = ",";
  let bestScore = 0;
  for (const d of DELIMITERS) {
    const counts = lines.map((line) => countOutsideQuotes(line, d));
    if (!counts.length || counts[0] === 0) continue;
    // Reward lines that match the first line's count, and more fields.
    const consistent = counts.filter((c) => c === counts[0]).length / counts.length;
    const score = consistent * 100 + counts[0];
    if (score > bestScore) {
      best = d;
      bestScore = score;
    }
  }
  return best;
}

// Quoted fields can span physical lines, so sample complete CSV records.
function sampleRecords(text) {
  const records = [];
  let start = 0;
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') {
        i += 1; // escaped quote inside a quoted field
        continue;
      }
      quoted = !quoted;
    } else if (!quoted && (ch === "\r" || ch === "\n")) {
      const record = text.slice(start, i);
      if (record.trim() !== "") records.push(record);
      if (records.length >= 20) return records;
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      start = i + 1;
    }
  }
  const last = text.slice(start);
  if (last.trim() !== "" && records.length < 20) records.push(last);
  return records;
}

function countOutsideQuotes(line, delimiter) {
  let count = 0;
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === delimiter && !quoted) count += 1;
  }
  return count;
}

/** Parse CSV text into an array of rows, each an array of strings. */
export function parse(text, delimiter = detectDelimiter(text)) {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // drop a byte-order mark
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        field += '"';
        i += 2;
        continue;
      }
      if (ch === '"') quoted = false;
      else field += ch;
      i += 1;
      continue;
    }
    if (ch === '"' && field === "") quoted = true;
    else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      if (ch === "\r" && input[i + 1] === "\n") i += 1;
    } else field += ch;
    i += 1;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return { rows, delimiter };
}

function quote(value, delimiter) {
  const text = String(value ?? "");
  return /["\r\n]/.test(text) || text.includes(delimiter) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Turn rows back into CSV text, quoting only the fields that need it. */
export function stringify(rows, delimiter = ",") {
  return rows.map((row) => row.map((v) => quote(v, delimiter)).join(delimiter)).join("\r\n") + "\r\n";
}
