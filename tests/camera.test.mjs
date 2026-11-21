import assert from "node:assert/strict";
import test from "node:test";

import { Camera } from "../dist/geometry/camera.js";
import { Matrix4 } from "../dist/geometry/matrix4.js";
import { Vector3 } from "../dist/geometry/vector3.js";

function matrixSnapshot(matrix) {
  return [
    matrix.n11, matrix.n12, matrix.n13, matrix.n14,
    matrix.n21, matrix.n22, matrix.n23, matrix.n24,
    matrix.n31, matrix.n32, matrix.n33, matrix.n34,
    matrix.n41, matrix.n42, matrix.n43, matrix.n44,
  ];
}

function assertNumbersClose(actual, expected, epsilon = 1e-12) {
  assert.equal(actual.length, expected.length);
  for (let index = 0; index < actual.length; index += 1) {
    assert.ok(
      Math.abs(actual[index] - expected[index]) <= epsilon,
      `value ${index}: expected ${expected[index]}, received ${actual[index]}`,
    );
  }
}

test("Camera module installs no globals", () => {
  assert.equal(Object.hasOwn(globalThis, "$jit"), false);
  assert.equal(Object.hasOwn(globalThis, "Camera"), false);
});

test("Camera initializes the JIT 2.0.1 perspective and pose defaults", () => {
  const camera = new Camera(75, 16 / 9, 1, 1000);

  assertNumbersClose(
    matrixSnapshot(camera.projectionMatrix),
    matrixSnapshot(Matrix4.makePerspective(75, 16 / 9, 1, 1000)),
  );
  assert.deepEqual(camera.position, new Vector3(0, 0, 0));
  assert.deepEqual(camera.target, { position: new Vector3(0, 0, 0) });
  assert.deepEqual(camera.up, new Vector3(0, 1, 0));
  assert.deepEqual(matrixSnapshot(camera.matrix), matrixSnapshot(new Matrix4()));
});

test("updateMatrix applies the camera look-at transform", () => {
  const camera = new Camera(60, 1.5, 0.5, 100);
  camera.position.setc(2, 3, 8);
  camera.target.position.setc(0, 1, 0);

  assert.equal(camera.updateMatrix(), undefined);
  assertNumbersClose(matrixSnapshot(camera.matrix), [
    0.9701425001453319, 0, -0.24253562503633297, 0,
    -0.05716619504750295, 0.9718253158075502, -0.2286647801900118, -0.9718253158075503,
    0.23570226039551587, 0.23570226039551587, 0.9428090415820635, -8.720983634634088,
    0, 0, 0, 1,
  ]);
});

test("each Camera owns independent mutable pose state", () => {
  const first = new Camera(45, 1, 0.1, 100);
  const second = new Camera(45, 1, 0.1, 100);

  assert.notStrictEqual(first.position, second.position);
  assert.notStrictEqual(first.target, second.target);
  assert.notStrictEqual(first.target.position, second.target.position);
  assert.notStrictEqual(first.up, second.up);
  assert.notStrictEqual(first.matrix, second.matrix);
  assert.notStrictEqual(first.projectionMatrix, second.projectionMatrix);

  first.position.setc(4, -2, 9);
  first.target.position.setc(1, 1, 1);
  first.up.setc(0, 0, 1);
  first.updateMatrix();

  assert.deepEqual(second.position, new Vector3());
  assert.deepEqual(second.target.position, new Vector3());
  assert.deepEqual(second.up, new Vector3(0, 1, 0));
  assert.deepEqual(matrixSnapshot(second.matrix), matrixSnapshot(new Matrix4()));
});
