import assert from "node:assert/strict";
import { test } from "node:test";

import { parseNumber } from "../src/values.js";
import { clean } from "../src/clean.js";
test("safe large integers are not rounded to fifteen digits", () => {
  assert.equal(parseNumber("1234567890123456").value, 1234567890123456);
  assert.equal(parseNumber("9,007,199,254,740,991").value, Number.MAX_SAFE_INTEGER);
});
test("unsafe integers and overflow stay unchanged in cleaned output", () => {
  for (const value of ["9007199254740993", "9".repeat(400)]) {
    assert.equal(parseNumber(value), null);
    assert.equal(clean([["ID"], [value]]).rows[0][0], value);
  }
});
