import assert from "node:assert/strict";
import test from "node:test";

import {
  hexToRgb,
  merge,
  reduce,
  rgbToHex,
  splat,
  typeOf,
  unlink,
  zip,
} from "../src/core/util.ts";
import { loadLegacyNamespace, normalizeRealm } from "./legacy-harness.mjs";

const legacy = loadLegacyNamespace().util;

test("pure utility outputs stay aligned with the legacy implementation", () => {
  const mergeInputs = [
    { count: 1, nested: { left: true }, values: [1, 2] },
    { nested: { right: true }, values: [3] },
  ];

  assert.deepEqual(
    merge(...mergeInputs),
    normalizeRealm(legacy.merge(...mergeInputs)),
  );
  assert.deepEqual(zip([1, 2], ["a", "b"]), normalizeRealm(legacy.zip([1, 2], ["a", "b"])));
  assert.deepEqual(hexToRgb("#09f"), normalizeRealm(legacy.hexToRgb("#09f")));
  assert.equal(rgbToHex([15, 160, 255]), legacy.rgbToHex([15, 160, 255]));
  assert.equal(rgbToHex([1, 2, 3, 0]), legacy.rgbToHex([1, 2, 3, 0]));
});

test("legacy reverse-order reduce semantics remain explicit", () => {
  const subtract = (accumulator, value) => accumulator - value;
  assert.equal(reduce([1, 2, 3], subtract), legacy.reduce([1, 2, 3], subtract));
  assert.equal(reduce([1, 2, 3], subtract, 10), legacy.reduce([1, 2, 3], subtract, 10));
  assert.equal(reduce([], subtract, 10), 10);
});

test("unlink creates a deep copy without sharing arrays or objects", () => {
  const source = { nested: { value: 1 }, values: [1, { value: 2 }] };
  const copy = unlink(source);

  assert.deepEqual(copy, normalizeRealm(legacy.unlink(source)));
  assert.notEqual(copy, source);
  assert.notEqual(copy.nested, source.nested);
  assert.notEqual(copy.values, source.values);
});

test("typeOf and splat cover the legacy input categories", () => {
  for (const value of [null, undefined, 1, "text", [], {}, /x/, new Date(0)]) {
    assert.equal(typeOf(value), legacy.type(value));
  }

  assert.deepEqual(splat(3), [3]);
  assert.deepEqual(splat([3]), [3]);
});
