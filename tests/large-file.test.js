import assert from "node:assert/strict";
import { test } from "node:test";

import { clean } from "../src/clean.js";
test("large files retain every row without spreading them into function arguments", () => {
  const count = 200000;
  const input = [["name"], ...Array.from({length: count}, (_, i) => [`row-${i}`])];
  const result = clean(input, {convert: false, dropDuplicates: false});
  assert.equal(result.rows.length, count);
  assert.equal(result.rows.at(-1)[0], `row-${count - 1}`);
});
