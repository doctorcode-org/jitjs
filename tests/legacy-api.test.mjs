import assert from "node:assert/strict";
import test from "node:test";

import { loadLegacyNamespace } from "./legacy-harness.mjs";

test("the legacy public surface is recorded as a migration checklist", () => {
  assert.deepEqual(Object.keys(loadLegacyNamespace()).sort(), [
    "AreaChart",
    "BarChart",
    "Canvas",
    "Class",
    "Complex",
    "ForceDirected",
    "Graph",
    "Hypertree",
    "Icicle",
    "Layouts",
    "PieChart",
    "Polar",
    "RGraph",
    "ST",
    "Sunburst",
    "TM",
    "Trans",
    "id",
    "json",
    "util",
    "version",
  ]);
});
