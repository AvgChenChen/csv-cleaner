import assert from "node:assert/strict";
import { test } from "node:test";

import { dateOrder, isMissingMarker, parseBoolean, parseDateParts, parseNumber, toIsoDate } from "../src/values.js";

const value = (text) => parseNumber(text)?.value ?? null;

test("numbers as people type them", () => {
  assert.equal(value("1,234.50"), 1234.5);
  assert.equal(value("$1,234"), 1234);
  assert.equal(value(" -12 "), -12);
  assert.equal(value("(450)"), -450);
  assert.equal(value("$-5"), -5);
  assert.equal(value("12.5%"), 0.125);
  assert.equal(value(".5"), 0.5);
  assert.equal(value("1 000"), 1000);
});

test("things that aren't numbers", () => {
  for (const text of ["", "abc", "1,2", "12,34,567", "1.2.3", "$", "12 apples", "1e5"]) {
    assert.equal(parseNumber(text), null, text);
  }
});

test("leading zeros are noticed, because they usually mean a code", () => {
  assert.equal(parseNumber("01234").leadingZero, true);
  assert.equal(parseNumber("0.5").leadingZero, false);
});

test("missing-value placeholders", () => {
  for (const text of ["N/A", "na", "NULL", "-", " none ", "#N/A"]) assert.ok(isMissingMarker(text), text);
  assert.ok(!isMissingMarker("Nancy"));
});

test("dates in fixed formats", () => {
  assert.equal(toIsoDate(parseDateParts("2024-03-05"), "dmy"), "2024-03-05");
  assert.equal(toIsoDate(parseDateParts("2024/3/5"), "mdy"), "2024-03-05");
  assert.equal(toIsoDate(parseDateParts("Mar 5, 2024"), "dmy"), "2024-03-05");
  assert.equal(toIsoDate(parseDateParts("5 March 2024"), "dmy"), "2024-03-05");
  assert.equal(toIsoDate(parseDateParts("5-Sept-2024"), "dmy"), "2024-09-05");
});

test("impossible or two-digit-year dates are refused", () => {
  assert.equal(parseDateParts("2024-02-30"), null);
  assert.equal(parseDateParts("Feb 30, 2024"), null);
  assert.equal(parseDateParts("1/2/24"), null);
  assert.equal(parseDateParts("hello"), null);
});

test("the column decides day-first or month-first", () => {
  const parts = (...texts) => texts.map(parseDateParts);
  assert.equal(dateOrder(parts("25/12/2024", "03/04/2024")), "dmy"); // 25 can only be a day
  assert.equal(dateOrder(parts("12/25/2024", "03/04/2024")), "mdy");
  assert.equal(dateOrder(parts("03/04/2024", "05/06/2024")), "ambiguous");
  assert.equal(dateOrder(parts("25/12/2024", "12/25/2024")), "conflict");
  assert.equal(toIsoDate(parseDateParts("03/04/2024"), "dmy"), "2024-04-03");
  assert.equal(toIsoDate(parseDateParts("03/04/2024"), "mdy"), "2024-03-04");
  assert.equal(toIsoDate(parseDateParts("03/04/2024"), "ambiguous"), null);
});

test("yes/no words, but not numbers", () => {
  assert.equal(parseBoolean("Yes"), "TRUE");
  assert.equal(parseBoolean(" n "), "FALSE");
  assert.equal(parseBoolean("1"), null);
  assert.equal(parseBoolean("maybe"), null);
});
