import assert from "node:assert/strict";
import { test } from "node:test";

import { parse, stringify } from "../src/csv.js";
test("explicit empty records survive without a final newline", () => {
  assert.deepEqual(parse('""').rows, [[""]]);
  assert.deepEqual(parse('name\n""').rows, [["name"], [""]]);
  assert.deepEqual(parse('name\r\n""\r\n').rows, [["name"], [""]]);
  assert.deepEqual(parse("").rows, []);
  assert.deepEqual(parse(stringify([[""], ["x"]])).rows, [[""], ["x"]]);
});
