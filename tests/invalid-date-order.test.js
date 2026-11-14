import assert from "node:assert/strict";
import { test } from "node:test";

import { parseDateParts, dateOrder } from "../src/values.js";
import { clean } from "../src/clean.js";
test("impossible numeric dates cannot dictate a column's order", () => {
  for (const input of ["32/01/2024", "02/30/2024", "00/10/2024", "31/04/2024"])
    assert.equal(parseDateParts(input), null, input);
  assert.equal(dateOrder(["03/04/2024", "32/01/2024"].map(parseDateParts)), "ambiguous");
  const values = ["03/04/2024", "05/06/2024", "07/08/2024", "09/10/2024", "32/01/2024"];
  assert.deepEqual(clean([["Date"], ...values.map(x => [x])]).rows.flat(), values);
  assert.ok(parseDateParts("29/02/2024"));
  assert.equal(parseDateParts("29/02/2023"), null);
});
