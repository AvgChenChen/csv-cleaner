import assert from "node:assert/strict";
import { test } from "node:test";

import { detectDelimiter, parse, stringify } from "../src/csv.js";

test("plain rows split on commas and newlines", () => {
  assert.deepEqual(parse("a,b\n1,2\n").rows, [
    ["a", "b"],
    ["1", "2"],
  ]);
});

test("quoted fields can hold commas, newlines and doubled quotes", () => {
  const text = 'name,note\r\n"Smith, Jo","said ""hi""\nthen left"\r\n';
  assert.deepEqual(parse(text).rows, [
    ["name", "note"],
    ["Smith, Jo", 'said "hi"\nthen left'],
  ]);
});

test("a byte-order mark at the start is dropped", () => {
  assert.deepEqual(parse("﻿a,b\n1,2").rows[0], ["a", "b"]);
});

test("the last row doesn't need a newline, and empty fields are kept", () => {
  assert.deepEqual(parse("a,b,c\n1,,3").rows[1], ["1", "", "3"]);
});

test("the delimiter is detected", () => {
  assert.equal(detectDelimiter("a;b;c\n1;2;3\n"), ";");
  assert.equal(detectDelimiter("a\tb\n1\t2\n"), "\t");
  assert.equal(detectDelimiter("a|b\n1|2\n"), "|");
  // Commas inside quotes don't count, so semicolons win here.
  assert.equal(detectDelimiter('name;city\n"Lee, A";Toronto\n"Ng, B";Ottawa\n'), ";");
});

test("writing quotes only the fields that need it, and reading it back gives the same rows", () => {
  const rows = [
    ["name", "note"],
    ["Smith, Jo", 'said "hi"'],
    ["plain", "two\nlines"],
  ];
  const text = stringify(rows);
  assert.equal(text.split("\r\n")[0], "name,note");
  assert.ok(text.includes('"Smith, Jo"') && text.includes('"said ""hi"""'));
  assert.deepEqual(parse(text).rows, rows);
});

test("delimiter detection handles quoted line breaks in column names and values", () => {
  const text = '"First\nname";amount\r\n"Alice\nSmith";100\r\n';
  assert.equal(detectDelimiter(text), ";");
  assert.deepEqual(parse(text).rows, [
    ["First\nname", "amount"],
    ["Alice\nSmith", "100"],
  ]);
});

test("stringifying an empty CSV produces an empty file", () => {
  assert.equal(stringify([]), "");
  assert.deepEqual(parse(stringify([])).rows, []);
});
