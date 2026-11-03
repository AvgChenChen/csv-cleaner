# CSV cleaner

Spreadsheet exports are messy: extra spaces, "N/A" in number columns, `$1,250.00` next to
`1250`, dates written three different ways, duplicate rows. This tool cleans a CSV file in the
browser and gives you a report of **every change it made and every value it couldn't fix**, by
row number in the original file.

**Your file never leaves your computer.** It's read and cleaned in the browser, and the clean
copy is downloaded from memory. Nothing is uploaded.

## What it fixes

| Problem | What happens |
|---|---|
| Blank lines above the header, messy or repeated column names | Removed; names trimmed, blanks named `column_3`, repeats numbered `Name (2)` |
| Rows with too few or too many values | Short rows filled out; extra values kept in new `extra` columns and reported |
| Extra spaces, non-breaking spaces | Trimmed |
| `N/A`, `null`, `none`, `-` and similar | Made blank |
| Empty rows and empty columns | Removed |
| `$1,250.00`, `(45.00)`, `12%` | Written as `1250`, `-45`, `0.12` |
| `25/12/2025`, `Jan 5, 2026` | Written as `2025-12-25`, `2026-01-05` |
| `Yes`, `y`, `no` | Written as `TRUE`, `FALSE` |
| Exact duplicate rows | Removed, including copies that only matched after cleaning |

## What it deliberately doesn't guess

- **Codes with leading zeros stay as text.** `00123` is usually a store or account code, and
  turning it into `123` would break it.
- **Dates that could be either order are left alone.** If every date in a column fits both
  day-first and month-first (`03/04/2024`), the tool says so instead of picking one. It decides
  the order only when the column proves it (a `25` can only be a day).
- **Two-digit years are left alone**, because `1/2/24` could be 1924 or 2024.
- **A column is converted only when at least 80% of its values can be read.** Values that can't
  be read (`twelve` in an amount column, or the impossible date `31/02/2026`) are left exactly as
  they were and listed in the report.

## Run it

No install needed. Serve the folder and open it:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
npm test                      # runs the tests (Node 20 or newer)
```

Click **Try a messy sample file** to see it work on [made-up sales data](samples/messy-sales.csv).

## How it's built

```
index.html        the page
src/csv.js        reads and writes CSV: quoted fields, commas and line breaks inside quotes, delimiter detection
src/values.js     recognises numbers, dates, yes/no values and missing-value placeholders
src/clean.js      the cleaning steps, in order, each recording what it changed
src/app.js        the page: file picker, drag and drop, options, report, download
tests/            29 tests using Node's built-in test runner
docs/WALKTHROUGH.md  plain-language explanation of every step and design choice
```

- **The cleaning code doesn't touch the browser**, so it's tested directly with small examples.
- **No libraries**, so there's nothing to install and nothing to keep up to date.
- **File contents are never inserted as HTML**, so a malicious file can't run code in the page.

## Limitations

- **"." is the decimal point.** European-style numbers like `1.234,56` aren't converted.
- **Date and time together** (`2026-01-05 14:30`) is left as text.
- **One file at a time**, up to 50 MB.

## How this was built

AI-assisted: the code, tests and write-up were produced with Claude Code, then reviewed. The
commits say so with a `Co-Authored-By` line.

## Licence

MIT
