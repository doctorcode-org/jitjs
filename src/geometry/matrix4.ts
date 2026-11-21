import { Vector3 } from "./vector3.js";
import type { Vector3Coordinates } from "./vector3.js";

export interface TransformableVector3 extends Vector3Coordinates {
  w?: number;
}

export interface Matrix4Values {
  n11: number;
  n12: number;
  n13: number;
  n14: number;
  n21: number;
  n22: number;
  n23: number;
  n24: number;
  n31: number;
  n32: number;
  n33: number;
  n34: number;
  n41: number;
  n42: number;
  n43: number;
  n44: number;
}

/** Mutable row-major 4x4 matrix compatible with JIT's legacy 3D helpers. */
export class Matrix4 implements Matrix4Values {
  n11 = 1;
  n12 = 0;
  n13 = 0;
  n14 = 0;
  n21 = 0;
  n22 = 1;
  n23 = 0;
  n24 = 0;
  n31 = 0;
  n32 = 0;
  n33 = 1;
  n34 = 0;
  n41 = 0;
  n42 = 0;
  n43 = 0;
  n44 = 1;

  readonly _x = new Vector3();
  readonly _y = new Vector3();
  readonly _z = new Vector3();

  identity(): void {
    this.n11 = 1;
    this.n12 = 0;
    this.n13 = 0;
    this.n14 = 0;
    this.n21 = 0;
    this.n22 = 1;
    this.n23 = 0;
    this.n24 = 0;
    this.n31 = 0;
    this.n32 = 0;
    this.n33 = 1;
    this.n34 = 0;
    this.n41 = 0;
    this.n42 = 0;
    this.n43 = 0;
    this.n44 = 1;
  }

  lookAt(
    eye: Vector3Coordinates,
    center: Vector3Coordinates,
    up: Vector3Coordinates,
  ): void {
    const x = this._x;
    const y = this._y;
    const z = this._z;
    z.sub(eye, center).normalize();
    x.cross(up, z).normalize();
    y.cross(z, x).normalize();

    this.n11 = x.x;
    this.n12 = x.y;
    this.n13 = x.z;
    this.n14 = -x.dot(eye);
    this.n21 = y.x;
    this.n22 = y.y;
    this.n23 = y.z;
    this.n24 = -y.dot(eye);
    this.n31 = z.x;
    this.n32 = z.y;
    this.n33 = z.z;
    this.n34 = -z.dot(eye);
  }

  transform(vector: TransformableVector3): void {
    const x = vector.x;
    const y = vector.y;
    const z = vector.z;
    let w = vector.w ? vector.w : 1;

    vector.x = this.n11 * x + this.n12 * y + this.n13 * z + this.n14 * w;
    vector.y = this.n21 * x + this.n22 * y + this.n23 * z + this.n24 * w;
    vector.z = this.n31 * x + this.n32 * y + this.n33 * z + this.n34 * w;
    w = this.n41 * x + this.n42 * y + this.n43 * z + this.n44 * w;

    if (vector.w) {
      vector.w = w;
    } else {
      vector.x /= w;
      vector.y /= w;
      vector.z /= w;
    }
  }

  multiply(left: Matrix4Values, right: Matrix4Values): void {
    this.n11 = left.n11 * right.n11 + left.n12 * right.n21 + left.n13 * right.n31 + left.n14 * right.n41;
    this.n12 = left.n11 * right.n12 + left.n12 * right.n22 + left.n13 * right.n32 + left.n14 * right.n42;
    this.n13 = left.n11 * right.n13 + left.n12 * right.n23 + left.n13 * right.n33 + left.n14 * right.n43;
    this.n14 = left.n11 * right.n14 + left.n12 * right.n24 + left.n13 * right.n34 + left.n14 * right.n44;
    this.n21 = left.n21 * right.n11 + left.n22 * right.n21 + left.n23 * right.n31 + left.n24 * right.n41;
    this.n22 = left.n21 * right.n12 + left.n22 * right.n22 + left.n23 * right.n32 + left.n24 * right.n42;
    this.n23 = left.n21 * right.n13 + left.n22 * right.n23 + left.n23 * right.n33 + left.n24 * right.n43;
    this.n24 = left.n21 * right.n14 + left.n22 * right.n24 + left.n23 * right.n34 + left.n24 * right.n44;
    this.n31 = left.n31 * right.n11 + left.n32 * right.n21 + left.n33 * right.n31 + left.n34 * right.n41;
    this.n32 = left.n31 * right.n12 + left.n32 * right.n22 + left.n33 * right.n32 + left.n34 * right.n42;
    this.n33 = left.n31 * right.n13 + left.n32 * right.n23 + left.n33 * right.n33 + left.n34 * right.n43;
    this.n34 = left.n31 * right.n14 + left.n32 * right.n24 + left.n33 * right.n34 + left.n34 * right.n44;
    this.n41 = left.n41 * right.n11 + left.n42 * right.n21 + left.n43 * right.n31 + left.n44 * right.n41;
    this.n42 = left.n41 * right.n12 + left.n42 * right.n22 + left.n43 * right.n32 + left.n44 * right.n42;
    this.n43 = left.n41 * right.n13 + left.n42 * right.n23 + left.n43 * right.n33 + left.n44 * right.n43;
    this.n44 = left.n41 * right.n14 + left.n42 * right.n24 + left.n43 * right.n34 + left.n44 * right.n44;
  }

  $multiply(matrix: Matrix4Values): void {
    const n11 = this.n11;
    const n12 = this.n12;
    const n13 = this.n13;
    const n14 = this.n14;
    const n21 = this.n21;
    const n22 = this.n22;
    const n23 = this.n23;
    const n24 = this.n24;
    const n31 = this.n31;
    const n32 = this.n32;
    const n33 = this.n33;
    const n34 = this.n34;
    const n41 = this.n41;
    const n42 = this.n42;
    const n43 = this.n43;
    const n44 = this.n44;

    this.n11 = n11 * matrix.n11 + n12 * matrix.n21 + n13 * matrix.n31 + n14 * matrix.n41;
    this.n12 = n11 * matrix.n12 + n12 * matrix.n22 + n13 * matrix.n32 + n14 * matrix.n42;
    this.n13 = n11 * matrix.n13 + n12 * matrix.n23 + n13 * matrix.n33 + n14 * matrix.n43;
    this.n14 = n11 * matrix.n14 + n12 * matrix.n24 + n13 * matrix.n34 + n14 * matrix.n44;
    this.n21 = n21 * matrix.n11 + n22 * matrix.n21 + n23 * matrix.n31 + n24 * matrix.n41;
    this.n22 = n21 * matrix.n12 + n22 * matrix.n22 + n23 * matrix.n32 + n24 * matrix.n42;
    this.n23 = n21 * matrix.n13 + n22 * matrix.n23 + n23 * matrix.n33 + n24 * matrix.n43;
    this.n24 = n21 * matrix.n14 + n22 * matrix.n24 + n23 * matrix.n34 + n24 * matrix.n44;
    this.n31 = n31 * matrix.n11 + n32 * matrix.n21 + n33 * matrix.n31 + n34 * matrix.n41;
    this.n32 = n31 * matrix.n12 + n32 * matrix.n22 + n33 * matrix.n32 + n34 * matrix.n42;
    this.n33 = n31 * matrix.n13 + n32 * matrix.n23 + n33 * matrix.n33 + n34 * matrix.n43;
    this.n34 = n31 * matrix.n14 + n32 * matrix.n24 + n33 * matrix.n34 + n34 * matrix.n44;
    this.n41 = n41 * matrix.n11 + n42 * matrix.n21 + n43 * matrix.n31 + n44 * matrix.n41;
    this.n42 = n41 * matrix.n12 + n42 * matrix.n22 + n43 * matrix.n32 + n44 * matrix.n42;
    this.n43 = n41 * matrix.n13 + n42 * matrix.n23 + n43 * matrix.n33 + n44 * matrix.n43;
    this.n44 = n41 * matrix.n14 + n42 * matrix.n24 + n43 * matrix.n34 + n44 * matrix.n44;
  }

  $scale(scalar: number): this {
    this.n11 *= scalar;
    this.n12 *= scalar;
    this.n13 *= scalar;
    this.n14 *= scalar;
    this.n21 *= scalar;
    this.n22 *= scalar;
    this.n23 *= scalar;
    this.n24 *= scalar;
    this.n31 *= scalar;
    this.n32 *= scalar;
    this.n33 *= scalar;
    this.n34 *= scalar;
    this.n41 *= scalar;
    this.n42 *= scalar;
    this.n43 *= scalar;
    this.n44 *= scalar;
    return this;
  }

  $add(matrix: Matrix4Values): this {
    this.n11 += matrix.n11;
    this.n12 += matrix.n12;
    this.n13 += matrix.n13;
    this.n14 += matrix.n14;
    this.n21 += matrix.n21;
    this.n22 += matrix.n22;
    this.n23 += matrix.n23;
    this.n24 += matrix.n24;
    this.n31 += matrix.n31;
    this.n32 += matrix.n32;
    this.n33 += matrix.n33;
    this.n34 += matrix.n34;
    this.n41 += matrix.n41;
    this.n42 += matrix.n42;
    this.n43 += matrix.n43;
    this.n44 += matrix.n44;
    return this;
  }

  determinant(): number {
    return (
      this.n14 * this.n23 * this.n32 * this.n41 -
      this.n13 * this.n24 * this.n32 * this.n41 -
      this.n14 * this.n22 * this.n33 * this.n41 +
      this.n12 * this.n24 * this.n33 * this.n41 +
      this.n13 * this.n22 * this.n34 * this.n41 -
      this.n12 * this.n23 * this.n34 * this.n41 -
      this.n14 * this.n23 * this.n31 * this.n42 +
      this.n13 * this.n24 * this.n31 * this.n42 +
      this.n14 * this.n21 * this.n33 * this.n42 -
      this.n11 * this.n24 * this.n33 * this.n42 -
      this.n13 * this.n21 * this.n34 * this.n42 +
      this.n11 * this.n23 * this.n34 * this.n42 +
      this.n14 * this.n22 * this.n31 * this.n43 -
      this.n12 * this.n24 * this.n31 * this.n43 -
      this.n14 * this.n21 * this.n32 * this.n43 +
      this.n11 * this.n24 * this.n32 * this.n43 +
      this.n12 * this.n21 * this.n34 * this.n43 -
      this.n11 * this.n22 * this.n34 * this.n43 -
      this.n13 * this.n22 * this.n31 * this.n44 +
      this.n12 * this.n23 * this.n31 * this.n44 +
      this.n13 * this.n21 * this.n32 * this.n44 -
      this.n11 * this.n23 * this.n32 * this.n44 -
      this.n12 * this.n21 * this.n33 * this.n44 +
      this.n11 * this.n22 * this.n33 * this.n44
    );
  }

  $transpose(): this {
    let temporary = this.n21;
    this.n21 = this.n12;
    this.n12 = temporary;
    temporary = this.n31;
    this.n31 = this.n13;
    this.n13 = temporary;
    temporary = this.n32;
    this.n32 = this.n23;
    this.n23 = temporary;
    temporary = this.n41;
    this.n41 = this.n14;
    this.n14 = temporary;
    temporary = this.n42;
    this.n42 = this.n24;
    this.n24 = temporary;
    temporary = this.n43;
    this.n43 = this.n34;
    this.n34 = temporary;
    return this;
  }

  clone(): Matrix4 {
    const matrix = new Matrix4();
    matrix.n11 = this.n11;
    matrix.n12 = this.n12;
    matrix.n13 = this.n13;
    matrix.n14 = this.n14;
    matrix.n21 = this.n21;
    matrix.n22 = this.n22;
    matrix.n23 = this.n23;
    matrix.n24 = this.n24;
    matrix.n31 = this.n31;
    matrix.n32 = this.n32;
    matrix.n33 = this.n33;
    matrix.n34 = this.n34;
    matrix.n41 = this.n41;
    matrix.n42 = this.n42;
    matrix.n43 = this.n43;
    matrix.n44 = this.n44;
    return matrix;
  }

  flatten(): number[] {
    return [
      this.n11, this.n21, this.n31, this.n41,
      this.n12, this.n22, this.n32, this.n42,
      this.n13, this.n23, this.n33, this.n43,
      this.n14, this.n24, this.n34, this.n44,
    ];
  }

  static translationMatrix(x: number, y: number, z: number): Matrix4 {
    const matrix = new Matrix4();
    matrix.n14 = x;
    matrix.n24 = y;
    matrix.n34 = z;
    return matrix;
  }

  static scaleMatrix(x: number, y: number, z: number): Matrix4 {
    const matrix = new Matrix4();
    matrix.n11 = x;
    matrix.n22 = y;
    matrix.n33 = z;
    return matrix;
  }

  static rotationXMatrix(theta: number): Matrix4 {
    const rotation = new Matrix4();
    rotation.n22 = rotation.n33 = Math.cos(theta);
    rotation.n32 = Math.sin(theta);
    rotation.n23 = -rotation.n32;
    return rotation;
  }

  static rotationYMatrix(theta: number): Matrix4 {
    const rotation = new Matrix4();
    rotation.n11 = rotation.n33 = Math.cos(theta);
    rotation.n13 = Math.sin(theta);
    rotation.n31 = -rotation.n13;
    return rotation;
  }

  static rotationZMatrix(theta: number): Matrix4 {
    const rotation = new Matrix4();
    rotation.n11 = rotation.n22 = Math.cos(theta);
    rotation.n21 = Math.sin(theta);
    rotation.n12 = -rotation.n21;
    return rotation;
  }

  static makeInvert(source: Matrix4Values & { determinant(): number }): Matrix4 {
    const matrix = new Matrix4();
    matrix.n11 = source.n23 * source.n34 * source.n42 - source.n24 * source.n33 * source.n42 + source.n24 * source.n32 * source.n43 - source.n22 * source.n34 * source.n43 - source.n23 * source.n32 * source.n44 + source.n22 * source.n33 * source.n44;
    matrix.n12 = source.n14 * source.n33 * source.n42 - source.n13 * source.n34 * source.n42 - source.n14 * source.n32 * source.n43 + source.n12 * source.n34 * source.n43 + source.n13 * source.n32 * source.n44 - source.n12 * source.n33 * source.n44;
    matrix.n13 = source.n13 * source.n24 * source.n42 - source.n14 * source.n23 * source.n42 + source.n14 * source.n22 * source.n43 - source.n12 * source.n24 * source.n43 - source.n13 * source.n22 * source.n44 + source.n12 * source.n23 * source.n44;
    matrix.n14 = source.n14 * source.n23 * source.n32 - source.n13 * source.n24 * source.n32 - source.n14 * source.n22 * source.n33 + source.n12 * source.n24 * source.n33 + source.n13 * source.n22 * source.n34 - source.n12 * source.n23 * source.n34;
    matrix.n21 = source.n24 * source.n33 * source.n41 - source.n23 * source.n34 * source.n41 - source.n24 * source.n31 * source.n43 + source.n21 * source.n34 * source.n43 + source.n23 * source.n31 * source.n44 - source.n21 * source.n33 * source.n44;
    matrix.n22 = source.n13 * source.n34 * source.n41 - source.n14 * source.n33 * source.n41 + source.n14 * source.n31 * source.n43 - source.n11 * source.n34 * source.n43 - source.n13 * source.n31 * source.n44 + source.n11 * source.n33 * source.n44;
    matrix.n23 = source.n14 * source.n23 * source.n41 - source.n13 * source.n24 * source.n41 - source.n14 * source.n21 * source.n43 + source.n11 * source.n24 * source.n43 + source.n13 * source.n21 * source.n44 - source.n11 * source.n23 * source.n44;
    matrix.n24 = source.n13 * source.n24 * source.n31 - source.n14 * source.n23 * source.n31 + source.n14 * source.n21 * source.n33 - source.n11 * source.n24 * source.n33 - source.n13 * source.n21 * source.n34 + source.n11 * source.n23 * source.n34;
    matrix.n31 = source.n22 * source.n34 * source.n41 - source.n24 * source.n32 * source.n41 + source.n24 * source.n31 * source.n42 - source.n21 * source.n34 * source.n42 - source.n22 * source.n31 * source.n44 + source.n21 * source.n32 * source.n44;
    matrix.n32 = source.n14 * source.n32 * source.n41 - source.n12 * source.n34 * source.n41 - source.n14 * source.n31 * source.n42 + source.n11 * source.n34 * source.n42 + source.n12 * source.n31 * source.n44 - source.n11 * source.n32 * source.n44;
    matrix.n33 = source.n13 * source.n24 * source.n41 - source.n14 * source.n22 * source.n41 + source.n14 * source.n21 * source.n42 - source.n11 * source.n24 * source.n42 - source.n12 * source.n21 * source.n44 + source.n11 * source.n22 * source.n44;
    matrix.n34 = source.n14 * source.n22 * source.n31 - source.n12 * source.n24 * source.n31 - source.n14 * source.n21 * source.n32 + source.n11 * source.n24 * source.n32 + source.n12 * source.n21 * source.n34 - source.n11 * source.n22 * source.n34;
    matrix.n41 = source.n23 * source.n32 * source.n41 - source.n22 * source.n33 * source.n41 - source.n23 * source.n31 * source.n42 + source.n21 * source.n33 * source.n42 + source.n22 * source.n31 * source.n43 - source.n21 * source.n32 * source.n43;
    matrix.n42 = source.n12 * source.n33 * source.n41 - source.n13 * source.n32 * source.n41 + source.n13 * source.n31 * source.n42 - source.n11 * source.n33 * source.n42 - source.n12 * source.n31 * source.n43 + source.n11 * source.n32 * source.n43;
    matrix.n43 = source.n13 * source.n22 * source.n41 - source.n12 * source.n23 * source.n41 - source.n13 * source.n21 * source.n42 + source.n11 * source.n23 * source.n42 + source.n12 * source.n21 * source.n43 - source.n11 * source.n22 * source.n43;
    matrix.n44 = source.n12 * source.n23 * source.n31 - source.n13 * source.n22 * source.n31 + source.n13 * source.n21 * source.n32 - source.n11 * source.n23 * source.n32 - source.n12 * source.n21 * source.n33 + source.n11 * source.n22 * source.n33;
    matrix.$scale(1 / source.determinant());
    return matrix;
  }

  static makeFrustum(
    left: number,
    right: number,
    bottom: number,
    top: number,
    near: number,
    far: number,
  ): Matrix4 {
    const matrix = new Matrix4();
    const x = (2 * near) / (right - left);
    const y = (2 * near) / (top - bottom);
    const a = (right + left) / (right - left);
    const b = (top + bottom) / (top - bottom);
    const c = -(far + near) / (far - near);
    const d = (-2 * far * near) / (far - near);
    matrix.n11 = x;
    matrix.n12 = 0;
    matrix.n13 = a;
    matrix.n14 = 0;
    matrix.n21 = 0;
    matrix.n22 = y;
    matrix.n23 = b;
    matrix.n24 = 0;
    matrix.n31 = 0;
    matrix.n32 = 0;
    matrix.n33 = c;
    matrix.n34 = d;
    matrix.n41 = 0;
    matrix.n42 = 0;
    matrix.n43 = -1;
    matrix.n44 = 0;
    return matrix;
  }

  static makePerspective(
    fieldOfView: number,
    aspect: number,
    near: number,
    far: number,
  ): Matrix4 {
    const maximumY = near * Math.tan((fieldOfView * Math.PI) / 360);
    const minimumY = -maximumY;
    const minimumX = minimumY * aspect;
    const maximumX = maximumY * aspect;
    return Matrix4.makeFrustum(minimumX, maximumX, minimumY, maximumY, near, far);
  }

  static makeOrtho(
    left: number,
    right: number,
    top: number,
    bottom: number,
    near: number,
    far: number,
  ): Matrix4 {
    const matrix = new Matrix4();
    const width = right - left;
    const height = bottom - top;
    const depth = far - near;
    const x = (right + left) / width;
    const y = (bottom + top) / height;
    const z = (far + near) / depth;
    matrix.n11 = 2 / width;
    matrix.n12 = 0;
    matrix.n13 = 0;
    matrix.n14 = -x;
    matrix.n21 = 0;
    matrix.n22 = 2 / height;
    matrix.n23 = 0;
    matrix.n24 = -y;
    matrix.n31 = 0;
    matrix.n32 = 0;
    matrix.n33 = -2 / depth;
    matrix.n34 = -z;
    matrix.n41 = 0;
    matrix.n42 = 0;
    matrix.n43 = 0;
    matrix.n44 = 1;
    return matrix;
  }
}
