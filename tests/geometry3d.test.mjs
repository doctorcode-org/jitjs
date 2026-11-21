import assert from "node:assert/strict";
import test from "node:test";

import { Matrix4 } from "../dist/geometry/matrix4.js";
import { Vector3 } from "../dist/geometry/vector3.js";

function vectorSnapshot(vector) {
  return { x: vector.x, y: vector.y, z: vector.z };
}

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

test("3D geometry modules install no globals", () => {
  assert.equal(Object.hasOwn(globalThis, "$jit"), false);
  assert.equal(Object.hasOwn(globalThis, "Vector3"), false);
  assert.equal(Object.hasOwn(globalThis, "Matrix4"), false);
});

test("Vector3 retains the characterized JIT 2.0.1 mutation contract", () => {
  assert.deepEqual(vectorSnapshot(new Vector3(0, Number.NaN, -0)), { x: 0, y: 0, z: 0 });
  const vector = new Vector3(1, -2, 3);
  assert.strictEqual(vector.getc(), vector);
  assert.strictEqual(vector.$add({ x: 2, y: 3, z: -4 }), vector);
  assert.deepEqual(vectorSnapshot(vector), { x: 3, y: 1, z: -1 });
  assert.strictEqual(vector.$sub({ x: 1, y: -1, z: 2 }), vector);
  assert.deepEqual(vectorSnapshot(vector), { x: 2, y: 2, z: -3 });
  assert.strictEqual(vector.$multiply({ x: -2, y: 4, z: 0.5 }), vector);
  assert.deepEqual(vectorSnapshot(vector), { x: -4, y: 8, z: -1.5 });
  assert.strictEqual(vector.$scale(-3), vector);
  assert.deepEqual(vectorSnapshot(vector), { x: 12, y: -24, z: 4.5 });
  assert.strictEqual(vector.addScalar(2), vector);
  assert.deepEqual(vectorSnapshot(vector), { x: 14, y: -22, z: 6.5 });
  assert.strictEqual(vector.negate(), vector);
  assert.deepEqual(vectorSnapshot(vector), { x: -14, y: 22, z: -6.5 });
  assert.strictEqual(vector.normalize(), vector);
  assert.ok(Math.abs(vector.norm() - 1) < 1e-15);

  const replacement = { x: 7, y: 8, z: 9 };
  assert.equal(vector.set(replacement), undefined);
  assert.deepEqual(vectorSnapshot(vector), replacement);
  assert.equal(vector.setc(-1, -2, -3), undefined);
  assert.deepEqual(vectorSnapshot(vector), { x: -1, y: -2, z: -3 });
});

test("Vector3 binary operations and edge thresholds retain legacy values", () => {
  const left = { x: 1, y: 2, z: 3 };
  const right = { x: -4, y: 5, z: 6 };
  assert.deepEqual(vectorSnapshot(new Vector3().add(left, right)), { x: -3, y: 7, z: 9 });
  assert.deepEqual(vectorSnapshot(new Vector3().sub(left, right)), { x: 5, y: -3, z: -3 });
  assert.deepEqual(vectorSnapshot(new Vector3().cross(left, right)), { x: -3, y: -18, z: 13 });
  assert.deepEqual(
    vectorSnapshot(new Vector3(2, -3, 4).$cross({ x: 5, y: 6, z: -7 })),
    { x: -3, y: 34, z: 27 },
  );
  assert.equal(new Vector3(0.000099, 0, 0).isZero(), true);
  assert.equal(new Vector3(0.0001, 0, 0).isZero(), false);
  assert.equal(new Vector3(1, 2, 3).distanceToSquared({ x: 4, y: 6, z: 3 }), 25);
  assert.equal(new Vector3(1, 2, 3).distanceTo({ x: 4, y: 6, z: 3 }), 5);
  assert.deepEqual(vectorSnapshot(new Vector3(1, 2, 3).clone()), { x: 1, y: 2, z: 3 });
});

test("Matrix4 factories and column-major flattening retain legacy values", () => {
  assert.deepEqual(matrixSnapshot(Matrix4.translationMatrix(2, -3, 4)), [
    1, 0, 0, 2,
    0, 1, 0, -3,
    0, 0, 1, 4,
    0, 0, 0, 1,
  ]);
  assert.deepEqual(matrixSnapshot(Matrix4.scaleMatrix(2, 3, 4)), [
    2, 0, 0, 0,
    0, 3, 0, 0,
    0, 0, 4, 0,
    0, 0, 0, 1,
  ]);

  const rotation = Matrix4.rotationXMatrix(0.7);
  assert.equal(rotation.n22, Math.cos(0.7));
  assert.equal(rotation.n23, -Math.sin(0.7));
  assert.equal(rotation.n32, Math.sin(0.7));
  assert.deepEqual(rotation.flatten(), [
    rotation.n11, rotation.n21, rotation.n31, rotation.n41,
    rotation.n12, rotation.n22, rotation.n32, rotation.n42,
    rotation.n13, rotation.n23, rotation.n33, rotation.n43,
    rotation.n14, rotation.n24, rotation.n34, rotation.n44,
  ]);

  const perspective = Matrix4.makePerspective(45, 16 / 9, 0.1, 100);
  assertNumbersClose(matrixSnapshot(perspective), [
    1.3579951288348662, 0, 0, 0,
    0, 2.4142135623730954, 0, 0,
    0, 0, -1.002002002002002, -0.20020020020020018,
    0, 0, -1, 0,
  ]);
});

test("Matrix4 multiplication and homogeneous transforms retain legacy behavior", () => {
  const left = Matrix4.rotationXMatrix(0.3);
  left.n14 = 4;
  const product = new Matrix4();
  assert.equal(product.multiply(left, Matrix4.scaleMatrix(2, 3, 4)), undefined);
  assertNumbersClose(matrixSnapshot(product), [
    2, 0, 0, 4,
    0, 2.866009467376818, -1.1820808266453582, 0,
    0, 0.8865606199840186, 3.821345956502424, 0,
    0, 0, 0, 1,
  ]);

  const point = { x: 2, y: -1, z: 5 };
  assert.equal(product.transform(point), undefined);
  assertNumbersClose([point.x, point.y, point.z], [8, -8.77641360060361, 18.2201691625281]);

  const homogeneous = { x: 1, y: 2, z: 3, w: 2 };
  Matrix4.translationMatrix(4, 5, 6).transform(homogeneous);
  assert.deepEqual(homogeneous, { x: 9, y: 12, z: 15, w: 2 });
});

test("Matrix4 inverse, transpose, clone, and camera values are characterized", () => {
  const matrix = Matrix4.makePerspective(60, 1.5, 0.5, 100);
  assert.equal(matrix.$multiply(Matrix4.translationMatrix(3, -4, 8)), undefined);
  assert.strictEqual(matrix.$add(Matrix4.scaleMatrix(0.5, 1.5, 2.5)), matrix);
  assert.strictEqual(matrix.$scale(0.25), matrix);
  assert.equal(matrix.determinant(), -0.40768793119485325);
  assertNumbersClose(matrixSnapshot(Matrix4.makeInvert(matrix)), [
    2.417355834015698, 0, 0.42910242913513963, 0.6393410564752205,
    0, 1.2376043070340124, -0.43937181856608465, -0.6546419306776085,
    0, 0, 1.4347882065147421, -1.86223767220291,
    0, 0, -0.2049697437878203, -0.3053946182567272,
  ]);
  const clone = matrix.clone();
  assert.notStrictEqual(clone, matrix);
  assert.deepEqual(matrixSnapshot(clone), matrixSnapshot(matrix));
  assert.strictEqual(matrix.$transpose(), matrix);

  const camera = new Matrix4();
  assert.equal(
    camera.lookAt(
      { x: 2, y: 3, z: 8 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 1, z: 0 },
    ),
    undefined,
  );
  assertNumbersClose(matrixSnapshot(camera), [
    0.9701425001453319, 0, -0.24253562503633297, 0,
    -0.05716619504750295, 0.9718253158075502, -0.2286647801900118, -0.9718253158075503,
    0.23570226039551587, 0.23570226039551587, 0.9428090415820635, -8.720983634634088,
    0, 0, 0, 1,
  ]);
});
