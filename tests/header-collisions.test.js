import assert from "node:assert/strict";
import { test } from "node:test";

import { clean } from "../src/clean.js";
test("deduplication avoids real numbered headers and generated extras", () => {
  const result = clean([["A", "A", "A (2)", "extra_1"], ["x", "y", "z", "q", "extra"]], {convert: false});
  assert.equal(new Set(result.header.map(x => x.toLowerCase())).size, result.header.length);
  assert.equal(result.header[2], "A (2)");
  assert.deepEqual(result.rows[0], ["x", "y", "z", "q", "extra"]);
});
test("blank and explicit column names do not collide", () => {
  const result = clean([["", "column_1", "COLUMN_1 (2)"], ["a", "b", "c"]]);
  assert.equal(new Set(result.header.map(x => x.toLowerCase())).size, 3);
});
