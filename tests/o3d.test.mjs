import assert from "node:assert/strict";
import test from "node:test";

import { Vector3 } from "../dist/geometry/vector3.js";
import {
  O3DBase,
  O3DCube,
  O3DSphere,
  O3DTube,
  createO3DGeometry,
} from "../dist/geometry/o3d.js";

function matrixValues(matrix) {
  return [
    matrix.n11, matrix.n12, matrix.n13, matrix.n14,
    matrix.n21, matrix.n22, matrix.n23, matrix.n24,
    matrix.n31, matrix.n32, matrix.n33, matrix.n34,
    matrix.n41, matrix.n42, matrix.n43, matrix.n44,
  ];
}

function element(position, data = {}) {
  return {
    pos: new Vector3(...position),
    getData(property) {
      return data[property];
    },
  };
}

test("O3D entry point is registry-free and factory failures are explicit", () => {
  assert.equal(Object.hasOwn(globalThis, "$jit"), false);
  assert.equal(Object.hasOwn(globalThis, "O3D"), false);
  assert.ok(createO3DGeometry("cube") instanceof O3DCube);
  assert.ok(createO3DGeometry("sphere") instanceof O3DSphere);
  assert.ok(createO3DGeometry("tube") instanceof O3DTube);
  assert.throws(() => createO3DGeometry("missing"), /Unknown O3D geometry type/);
});

test("base dispatch, transforms, and normals preserve source behavior", () => {
  class SpyGeometry extends O3DBase {
    calls = [];
    updateNode(value) { this.calls.push(["node", value]); }
    updateEdge(value) { this.calls.push(["edge", value]); }
  }
  const geometry = new SpyGeometry();
  const node = element([0, 0, 0]);
  const edge = { ...element([0, 0, 0]), nodeFrom: node, nodeTo: node };
  geometry.update(node);
  geometry.update(edge);
  assert.deepEqual(geometry.calls.map(([kind]) => kind), ["node", "edge"]);

  geometry.position.setc(2, 3, 4);
  geometry.rotation.setc(0, 0, Math.PI / 2);
  geometry.scale.setc(2, 3, 4);
  geometry.updateMatrix();
  assert.deepEqual(matrixValues(geometry.matrix), [
    1.2246467991473532e-16, -3, 0, 2,
    2, 1.8369701987210297e-16, 0, 3,
    0, 0, 4, 4,
    0, 0, 0, 1,
  ]);
});

test("cube topology, face normals, and node transforms match the legacy primitive", () => {
  const cube = new O3DCube();
  assert.equal(cube.vertices.length, 8);
  assert.equal(cube.faces.length, 6);
  assert.deepEqual(cube.vertices[0], { x: 1, y: 1, z: -1 });
  assert.deepEqual(
    cube.faces.map(({ a, b, c, d }) => ({ a, b, c, d })),
    [
      { a: 0, b: 1, c: 2, d: 3 },
      { a: 4, b: 7, c: 6, d: 5 },
      { a: 0, b: 4, c: 5, d: 1 },
      { a: 1, b: 5, c: 6, d: 2 },
      { a: 2, b: 6, c: 7, d: 3 },
      { a: 4, b: 0, c: 3, d: 7 },
    ],
  );
  assert.deepEqual(cube.faces[0].normal, new Vector3(0, 0, -1));
  assert.ok(cube.faces.every((face) => Math.abs(face.normal.norm() - 1) < 1e-12));
  cube.update(element([2, 3, 4], { dim: 5 }));
  assert.deepEqual(matrixValues(cube.matrix), [
    5, 0, 0, 2,
    0, 5, 0, 3,
    0, 0, 5, 4,
    0, 0, 0, 1,
  ]);
});

test("sphere keeps the source's shared pole topology and normalized faces", () => {
  const sphere = new O3DSphere();
  assert.equal(sphere.vertices.length, 92);
  assert.equal(sphere.faces.length, 180);
  assert.deepEqual(sphere.vertices[0], { x: 0, y: 1, z: 0 });
  assert.ok(sphere.faces.every((face) => Math.abs(face.normal.norm() - 1) < 1e-12));
  sphere.update(element([-2, 6, 9], { dim: 3 }));
  assert.deepEqual([sphere.matrix.n11, sphere.matrix.n22, sphere.matrix.n33], [3, 3, 3]);
  assert.deepEqual([sphere.matrix.n14, sphere.matrix.n24, sphere.matrix.n34], [-2, 6, 9]);
});

test("tube topology and edge rotation align its z axis with the graph edge", () => {
  const tube = new O3DTube();
  assert.equal(tube.vertices.length, 20);
  assert.equal(tube.faces.length, 10);
  assert.ok(tube.faces.every((face) => Math.abs(face.normal.norm() - 1) < 1e-12));
  const from = element([0, 0, 0]);
  const to = element([0, 2, 0]);
  const edge = { ...element([0, 0, 0], { lineWidth: 2 }), nodeFrom: from, nodeTo: to };
  tube.update(edge);
  assert.deepEqual(tube.position, new Vector3(0, 1, 0));
  assert.deepEqual(tube.scale, new Vector3(2, 2, 2));
  const transformedDirection = new Vector3(0, 0, 1);
  tube.rotationMatrix.transform(transformedDirection);
  assert.ok(Math.abs(transformedDirection.x) < 1e-12);
  assert.ok(Math.abs(transformedDirection.y - 1) < 1e-12);
  assert.ok(Math.abs(transformedDirection.z) < 1e-12);
  assert.deepEqual([tube.matrix.n14, tube.matrix.n24, tube.matrix.n34], [0, 1, 0]);
});
