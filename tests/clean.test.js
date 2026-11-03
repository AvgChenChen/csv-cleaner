import assert from "node:assert/strict";
import { test } from "node:test";

import { clean, describeColumn } from "../src/clean.js";
import { parse } from "../src/csv.js";

const run = (text, options) => clean(parse(text).rows, options);
const count = (result, label) => result.steps.find((s) => s.label.startsWith(label))?.count;

test("header names are trimmed, blanks named and repeats numbered", () => {
  const result = run(" Name ,,Name\nA,1,B\n");
  assert.deepEqual(result.header, ["Name", "column_2", "Name (2)"]);
  assert.equal(count(result, "Column names"), 3);
});

test("blank lines above the header are skipped and row numbers still match the file", () => {
  const result = run("\n\nid,amount\n1,abc\n");
  assert.deepEqual(result.header, ["id", "amount"]);
  assert.equal(result.lines[0], 4);
});

test("spaces are trimmed and placeholders become blank", () => {
  const result = run("name,city\n  Ana   Lee ,N/A\nBo,Ottawa\n");
  assert.deepEqual(result.rows[0], ["Ana Lee", ""]);
  assert.equal(count(result, "Cells with extra spaces"), 1);
  assert.equal(count(result, "Placeholders"), 1);
});

test("empty rows and empty columns are removed", () => {
  const result = run("a,b,c\n1,,2\n,,\n3,,4\n");
  assert.deepEqual(result.header, ["a", "c"]);
  assert.deepEqual(result.rows, [["1", "2"], ["3", "4"]]);
  assert.equal(count(result, "Empty rows"), 1);
  assert.equal(result.steps.find((s) => s.label === "Empty columns removed").detail, "b");
});

test("short rows are filled out and extra values get their own column", () => {
  const result = run("a,b\n1\n2,3,4\n");
  assert.deepEqual(result.header, ["a", "b", "extra_1"]);
  assert.deepEqual(result.rows, [["1", "", ""], ["2", "3", "4"]]);
  assert.equal(result.issues[0].line, 3);
});

test("a number column is written plainly, and an unreadable value is reported with its row", () => {
  const values = ['"$1,200"', "(300)", "450", "12", "7", "8", "9", "10", "11", "13", "oops"];
  const text = `amount\n${values.join("\n")}\n`;
  const result = run(text);
  const col = result.columns[0];
  assert.equal(col.type, "number");
  assert.deepEqual(result.rows.slice(0, 3).flat(), ["1200", "-300", "450"]);
  assert.equal(col.failed.length, 1);
  assert.deepEqual(result.issues.map((i) => i.line), [12]);
  assert.match(col.note, /currency/i);
  assert.match(col.note, /brackets written as negatives/);
});

test("a column that is mostly text isn't converted", () => {
  const result = run("note\n12\nhello\nworld\n");
  assert.equal(result.columns[0].type, "text");
  assert.deepEqual(result.rows.flat(), ["12", "hello", "world"]);
});

test("codes with leading zeros stay as text", () => {
  const col = describeColumn("account", ["00123", "04567", "12345"]);
  assert.equal(col.type, "text");
  assert.match(col.note, /leading zeros/);
});

test("dates become YYYY-MM-DD using the order the column shows", () => {
  const result = run("date\n25/12/2024\n03/04/2024\nJan 5 2024\n");
  assert.equal(result.columns[0].type, "date");
  assert.deepEqual(result.rows.flat(), ["2024-12-25", "2024-04-03", "2024-01-05"]);
});

test("dates that could be either order are left alone and explained", () => {
  const result = run("date\n03/04/2024\n05/06/2024\n");
  assert.equal(result.columns[0].type, "date (unclear)");
  assert.deepEqual(result.rows.flat(), ["03/04/2024", "05/06/2024"]);
  assert.match(result.columns[0].note, /March 4 or April 3/);
});

test("yes/no columns become TRUE and FALSE", () => {
  // "Yes" and "Y" become the same value, so the third row is then an exact duplicate.
  const result = run("active\nYes\nno\nY\n", { dropDuplicates: false });
  assert.deepEqual(result.rows.flat(), ["TRUE", "FALSE", "TRUE"]);
});

test("duplicates are found after cleaning, so differently written copies count", () => {
  // "$1,000" and " 1000 " are the same amount once cleaned.
  const result = run('name,amount\nAna,"$1,000"\nAna, 1000 \nBo,5\n');
  assert.equal(result.rows.length, 2);
  assert.equal(count(result, "Exact duplicate rows"), 1);
  assert.match(result.issues.at(-1).message, /copy of row 2/);
});

test("every step can be switched off", () => {
  const off = { trim: false, missing: false, dropEmptyRows: false, dropEmptyColumns: false, convert: false, dropDuplicates: false };
  const result = run("a,b\n 1 ,N/A\n,\n 1 ,N/A\n", off);
  assert.deepEqual(result.rows, [[" 1 ", "N/A"], ["", ""], [" 1 ", "N/A"]]);
});

test("an empty file gives an empty result instead of an error", () => {
  const result = run("\n\n");
  assert.deepEqual(result.header, []);
  assert.deepEqual(result.rows, []);
});

test("one unreadable value in a small column doesn't stop the rest converting", () => {
  // 8 of 9 values are numbers (89%), above the 80% bar.
  const result = run("amount\n1\n2\n3\n4\n5\n6\n7\n8\ntwelve\n");
  assert.equal(result.columns[0].type, "number");
  assert.equal(result.columns[0].failed[0].value, "twelve");
});
