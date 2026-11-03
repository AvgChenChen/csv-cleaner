# Walkthrough: how the cleaner works, in plain language

Read this before you talk about the project. Data cleaning is most of the real work in any
analyst, consulting or operations job, so the judgement calls here are worth being able to explain.

## The problem

Exports from CRMs, point-of-sale systems and accounting tools rarely come out clean. The same
amount appears as `$1,250.00` in one row and `1250` in another. Dates switch format. Someone typed
"N/A" in a number column. Before you can total a column or join two files, all of that has to be
fixed, and you need to know *what* was changed, or you can't trust the result.

## The steps, in order

The order matters. [`clean.js`](../src/clean.js) runs them like this:

1. **Find the header.** The first row with something in it. Blank lines above it are skipped, but
   row numbers in the report still match the original file, so you can find every problem.
2. **Tidy the column names.** Trim spaces, name blank columns (`column_9`), and number repeats.
3. **Fix the row lengths.** Short rows are filled out. Extra values aren't thrown away: they go
   into new `extra` columns and get reported, because losing data silently is the worst outcome.
4. **Trim spaces** in every cell, including the invisible non-breaking spaces web pages add.
5. **Blank out placeholders** like `N/A`, `null` and `-`.
6. **Remove empty rows and columns.** This runs after step 5, so a column that only ever said
   "N/A" counts as empty.
7. **Convert values** in columns that are clearly numbers, dates or yes/no.
8. **Remove duplicates last**, after everything else. That way `$89.99` and `89.99` are recognised
   as the same row. In the sample file, order 1002 is only caught because of this ordering.

## How it decides what a column holds

[`values.js`](../src/values.js) tries to read each value as yes/no, then as a number, then as a
date. A column is converted only if **at least 80%** of its filled-in values can be read. Below
that, it's probably a text column that happens to contain some numbers.

The values that can't be read are left exactly as they were and listed in the report. That's the
key design principle: **the tool never invents a value**. If it can't be sure, it tells you.

## Judgement calls, and why

- **Leading zeros mean "keep as text".** `00123` is almost always a code. Excel famously turns
  these into numbers and breaks them.
- **Day-first or month-first is decided by the whole column.** `03/04/2024` alone could be either.
  But if the same column contains `25/12/2025`, the first number must be the day, because there's
  no month 25. If nothing in the column proves the order, the dates are left alone and the report
  explains why. Guessing wrong would silently swap months and days across the whole file.
- **Impossible dates are rejected.** `31/02/2026` is reported, not "corrected" to March 3.
- **Brackets mean negative**, as in accounting statements: `(45.00)` becomes `-45`.
- **Percentages become decimals**, so `12%` becomes `0.12`, and the report says so.
- **Commas must be real thousands separators.** `1,234` is a number; `1,2` isn't, because in some
  countries that means 1.2 and the tool won't guess.

## Privacy and safety

- **Nothing is uploaded.** The browser reads the file and builds the download itself. That matters
  for customer lists and financial data, which often can't be put into online tools.
- **File contents are never treated as code.** The page inserts every value as plain text, so a
  file containing something like `<script>` can't run anything.

## How it's tested

29 tests check each piece on tiny examples where the right answer is obvious:
- CSV edge cases, such as a comma inside quotes, a line break inside a field, and Excel's
  invisible start-of-file marker.
- Every number and date format.
- The day-first or month-first decision.
- Each cleaning step, and turning each one off.

Writing the tests caught real problems. The first version needed 90% of values to be readable,
so one bad value stopped a 9-row amount column from converting. The fix was the 80% rule, with a
test.

## Questions you might be asked

- **"Why not just use Excel?"** Excel guesses silently: it turns codes into numbers and can read
  dates in the wrong order. This tool shows every change, and refuses to guess when it can't be sure.
- **"What would you add next?"** European number formats, a downloadable change log, and
  matching *near*-duplicates such as "Ana Lee" and "Ana  Lee." (the last needs care, because
  similar isn't the same).
- **"How would this scale?"** Everything runs in one pass per step, so a file of a few hundred
  thousand rows is fine in a browser. For millions of rows, the same steps would move to a
  script reading the file in chunks.
