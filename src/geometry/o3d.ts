import { Matrix4 } from "./matrix4.js";
import { Vector3 } from "./vector3.js";
import type { Vector3Coordinates } from "./vector3.js";

export interface O3DFace {
  a: number;
  b: number;
  c: number;
  d?: number;
  normal: Vector3;
}

export interface O3DElement {
  pos: Vector3;
  getData<TValue = unknown>(property: string): TValue;
}

export interface O3DEdgeElement extends O3DElement {
  nodeFrom: O3DElement;
  nodeTo: O3DElement;
}

function isEdgeElement(element: O3DElement): element is O3DEdgeElement {
  const candidate = element as Partial<O3DEdgeElement>;
  return Boolean(candidate.nodeFrom && candidate.nodeTo);
}

/** Shared, registry-free base for the legacy JIT 3D primitives. */
export class O3DBase<TElement extends O3DElement = O3DElement> {
  readonly vertices: Vector3Coordinates[] = [];
  readonly faces: O3DFace[] = [];
  readonly position = new Vector3();
  readonly rotation = new Vector3();
  readonly scale = new Vector3(1, 1, 1);
  readonly matrix = new Matrix4();

  update(element: TElement): void {
    if (isEdgeElement(element)) {
      this.updateEdge(element);
    } else {
      this.updateNode(element);
    }
  }

  updateNode(_element: O3DElement): void {}

  updateEdge(element: O3DEdgeElement): void {
    this.updateNode(element);
  }

  updateMatrix(): void {
    const position = this.position;
    const rotation = this.rotation;
    const scale = this.scale;
    this.matrix.identity();
    this.matrix.$multiply(
      Matrix4.translationMatrix(position.x, position.y, position.z),
    );
    this.matrix.$multiply(Matrix4.rotationXMatrix(rotation.x));
    this.matrix.$multiply(Matrix4.rotationYMatrix(rotation.y));
    this.matrix.$multiply(Matrix4.rotationZMatrix(rotation.z));
    this.matrix.$multiply(Matrix4.scaleMatrix(scale.x, scale.y, scale.z));
  }

  computeNormals(): void {
    for (const face of this.faces) {
      const vertexA = this.vertices[face.a] as Vector3Coordinates;
      const vertexB = this.vertices[face.b] as Vector3Coordinates;
      const vertexC = this.vertices[face.c] as Vector3Coordinates;
      const cb = new Vector3().sub(vertexC, vertexB);
      const ab = new Vector3().sub(vertexA, vertexB);
      cb.$cross(ab);
      if (!cb.isZero()) {
        cb.normalize();
      }
      face.normal = cb;
    }
  }

  protected addFace(a: number, b: number, c: number, d?: number): void {
    this.faces.push({ a, b, c, ...(d === undefined ? {} : { d }), normal: new Vector3() });
  }
}

function addIsoCube(geometry: O3DBase): void {
  geometry.vertices.push(
    { x: 1, y: 1, z: -1 },
    { x: 1, y: -1, z: -1 },
    { x: -1, y: -1, z: -1 },
    { x: -1, y: 1, z: -1 },
    { x: 1, y: 1, z: 1 },
    { x: 1, y: -1, z: 1 },
    { x: -1, y: -1, z: 1 },
    { x: -1, y: 1, z: 1 },
  );
  geometry.faces.push(
    { a: 0, b: 1, c: 2, d: 3, normal: new Vector3() },
    { a: 4, b: 7, c: 6, d: 5, normal: new Vector3() },
    { a: 0, b: 4, c: 5, d: 1, normal: new Vector3() },
    { a: 1, b: 5, c: 6, d: 2, normal: new Vector3() },
    { a: 2, b: 6, c: 7, d: 3, normal: new Vector3() },
    { a: 4, b: 0, c: 3, d: 7, normal: new Vector3() },
  );
}

export class O3DCube extends O3DBase {
  constructor() {
    super();
    addIsoCube(this);
    this.computeNormals();
  }

  override updateNode(element: O3DElement): void {
    const dimension = element.getData<number>("dim");
    this.position.setc(element.pos.x, element.pos.y, element.pos.z);
    this.scale.setc(dimension, dimension, dimension);
    this.updateMatrix();
  }
}

export class O3DSphere extends O3DBase {
  readonly radius = 1;
  readonly segmentsWidth = 10;
  readonly segmentsHeight = 10;

  constructor() {
    super();
    const horizontalCount = Math.max(3, this.segmentsWidth || 8);
    const verticalCount = Math.max(2, this.segmentsHeight || 6);
    const grid: number[][] = [];

    for (let vertical = 0; vertical < verticalCount + 1; vertical += 1) {
      const latitude = vertical / verticalCount;
      const z = this.radius * Math.cos(latitude * Math.PI);
      const ringRadius = this.radius * Math.sin(latitude * Math.PI);
      const row: number[] = [];
      let vertexIndex = 0;
      for (let horizontal = 0; horizontal < horizontalCount; horizontal += 1) {
        const longitude = (2 * horizontal) / horizontalCount;
        const x = ringRadius * Math.sin(longitude * Math.PI);
        const y = ringRadius * Math.cos(longitude * Math.PI);
        if (!((vertical === 0 || vertical === verticalCount) && horizontal > 0)) {
          vertexIndex = this.vertices.push({ x: y, y: z, z: x }) - 1;
        }
        row.push(vertexIndex);
      }
      grid.push(row);
    }

    for (let vertical = 0; vertical < grid.length; vertical += 1) {
      const row = grid[vertical] as number[];
      if (vertical === 0) {
        continue;
      }
      const previousRow = grid[vertical - 1] as number[];
      for (let horizontal = 0; horizontal < row.length; horizontal += 1) {
        const atEnd = horizontal === row.length - 1;
        const point1 = row[atEnd ? 0 : horizontal + 1] as number;
        const point2 = row[atEnd ? row.length - 1 : horizontal] as number;
        const point3 = previousRow[atEnd ? row.length - 1 : horizontal] as number;
        const point4 = previousRow[atEnd ? 0 : horizontal + 1] as number;
        if (vertical < grid.length - 1) {
          this.addFace(point1, point2, point3);
        }
        if (vertical > 1) {
          this.addFace(point1, point3, point4);
        }
      }
    }
    this.computeNormals();
  }

  override updateNode(element: O3DElement): void {
    const dimension = element.getData<number>("dim");
    this.position.setc(element.pos.x, element.pos.y, element.pos.z);
    this.scale.setc(dimension, dimension, dimension);
    this.updateMatrix();
  }
}

export class O3DTube extends O3DBase<O3DEdgeElement> {
  readonly numSegments = 10;
  readonly dimension = 1;
  rotationMatrix = new Matrix4();

  constructor() {
    super();
    const fullCircle = Math.PI * 2;
    for (let index = 0; index < this.numSegments; index += 1) {
      this.vertices.push({
        x: Math.sin((fullCircle * index) / this.numSegments) * this.dimension,
        y: Math.cos((fullCircle * index) / this.numSegments) * this.dimension,
        z: -0.5,
      });
    }
    for (let index = 0; index < this.numSegments; index += 1) {
      this.vertices.push({
        x: Math.sin((fullCircle * index) / this.numSegments) * this.dimension,
        y: Math.cos((fullCircle * index) / this.numSegments) * this.dimension,
        z: 0.5,
      });
    }
    for (let index = 0; index < this.numSegments; index += 1) {
      this.addFace(
        index,
        (index + 1) % this.numSegments,
        this.numSegments + ((index + 1) % this.numSegments),
        index + this.numSegments,
      );
    }
    this.computeNormals();
  }

  override updateEdge(element: O3DEdgeElement): void {
    const lineWidth = element.getData<number>("lineWidth");
    const from = element.nodeFrom.pos;
    const to = element.nodeTo.pos;
    const distance = from.distanceTo(to);
    const middle = new Vector3().add(from, to).$scale(0.5);
    const currentDirection = new Vector3(0, 0, 1);
    const direction = new Vector3().sub(to, from).normalize();
    const cosine = direction.dot(currentDirection);
    const complement = 1 - cosine;
    const sine = Math.sin(Math.acos(cosine));
    const rotationAxis = currentDirection.$cross(direction).normalize();
    const { x, y, z } = rotationAxis;
    const rotation = new Matrix4();
    rotation.n11 = complement * x * x + cosine;
    rotation.n12 = complement * x * y - sine * z;
    rotation.n13 = complement * x * z + sine * y;
    rotation.n21 = complement * x * y + sine * z;
    rotation.n22 = complement * y * y + cosine;
    rotation.n23 = complement * y * z - sine * x;
    rotation.n31 = complement * x * z - sine * y;
    rotation.n32 = complement * y * z + sine * x;
    rotation.n33 = complement * z * z + cosine;
    this.rotationMatrix = rotation;
    this.scale.setc(lineWidth, lineWidth, distance);
    this.position.setc(middle.x, middle.y, middle.z);
    this.updateMatrix();
  }

  override updateMatrix(): void {
    const position = this.position;
    const scale = this.scale;
    this.matrix.identity();
    this.matrix.$multiply(
      Matrix4.translationMatrix(position.x, position.y, position.z),
    );
    this.matrix.$multiply(this.rotationMatrix);
    this.matrix.$multiply(Matrix4.scaleMatrix(scale.x, scale.y, scale.z));
  }
}

export type O3DGeometry = O3DCube | O3DSphere | O3DTube;
export type O3DGeometryType = "cube" | "sphere" | "tube";

/** Explicit factory replacing the side-effectful legacy registry. */
export function createO3DGeometry(type: O3DGeometryType | string): O3DGeometry {
  switch (type) {
    case "cube":
      return new O3DCube();
    case "sphere":
      return new O3DSphere();
    case "tube":
      return new O3DTube();
    default:
      throw new Error(`Unknown O3D geometry type: ${type}`);
  }
}
