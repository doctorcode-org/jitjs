export interface Vector3Coordinates {
  x: number;
  y: number;
  z: number;
}

/** Mutable three-dimensional vector with JIT 2.0.1 arithmetic semantics. */
export class Vector3 implements Vector3Coordinates {
  x: number;
  y: number;
  z: number;

  constructor(x?: number, y?: number, z?: number) {
    this.x = x || 0;
    this.y = y || 0;
    this.z = z || 0;
  }

  set(vector: Vector3Coordinates): void {
    this.x = vector.x;
    this.y = vector.y;
    this.z = vector.z;
  }

  setc(x: number, y: number, z: number): void {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  getc(): this {
    return this;
  }

  add(left: Vector3Coordinates, right: Vector3Coordinates): this {
    this.x = left.x + right.x;
    this.y = left.y + right.y;
    this.z = left.z + right.z;
    return this;
  }

  $add(vector: Vector3Coordinates): this {
    this.x += vector.x;
    this.y += vector.y;
    this.z += vector.z;
    return this;
  }

  addScalar(scalar: number): this {
    this.x += scalar;
    this.y += scalar;
    this.z += scalar;
    return this;
  }

  sub(left: Vector3Coordinates, right: Vector3Coordinates): this {
    this.x = left.x - right.x;
    this.y = left.y - right.y;
    this.z = left.z - right.z;
    return this;
  }

  $sub(vector: Vector3Coordinates): this {
    this.x -= vector.x;
    this.y -= vector.y;
    this.z -= vector.z;
    return this;
  }

  cross(left: Vector3Coordinates, right: Vector3Coordinates): this {
    this.x = left.y * right.z - left.z * right.y;
    this.y = left.z * right.x - left.x * right.z;
    this.z = left.x * right.y - left.y * right.x;
    return this;
  }

  $cross(vector: Vector3Coordinates): this {
    const x = this.x;
    const y = this.y;
    const z = this.z;
    this.x = y * vector.z - z * vector.y;
    this.y = z * vector.x - x * vector.z;
    this.z = x * vector.y - y * vector.x;
    return this;
  }

  $multiply(vector: Vector3Coordinates): this {
    this.x *= vector.x;
    this.y *= vector.y;
    this.z *= vector.z;
    return this;
  }

  $scale(scalar: number): this {
    this.x *= scalar;
    this.y *= scalar;
    this.z *= scalar;
    return this;
  }

  dot(vector: Vector3Coordinates): number {
    return this.x * vector.x + this.y * vector.y + this.z * vector.z;
  }

  distanceTo(vector: Vector3Coordinates): number {
    return Math.sqrt(this.distanceToSquared(vector));
  }

  distanceToSquared(vector: Vector3Coordinates): number {
    const dx = this.x - vector.x;
    const dy = this.y - vector.y;
    const dz = this.z - vector.z;
    return dx * dx + dy * dy + dz * dz;
  }

  norm(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  normSquared(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  negate(): this {
    this.x = -this.x;
    this.y = -this.y;
    this.z = -this.z;
    return this;
  }

  normalize(): this {
    const length = this.norm();
    if (length > 0) {
      this.$scale(1 / length);
    }
    return this;
  }

  isZero(): boolean {
    const almostZero = 0.0001;
    return (
      Math.abs(this.x) < almostZero &&
      Math.abs(this.y) < almostZero &&
      Math.abs(this.z) < almostZero
    );
  }

  clone(): Vector3 {
    return new Vector3(this.x, this.y, this.z);
  }
}
