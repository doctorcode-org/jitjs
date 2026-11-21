/** Cartesian coordinates shared by the geometry primitives. */
export interface CartesianCoordinates {
  x: number;
  y: number;
}

/** Polar coordinates shared by the geometry primitives. */
export interface PolarCoordinates {
  theta: number;
  rho: number;
}

/** A value that can expose cartesian coordinates. */
export interface CartesianConvertible {
  getc(simple: true): CartesianCoordinates;
}

/** A value that can expose polar coordinates. */
export interface PolarConvertible {
  getp(): PolarCoordinates;
}

/**
 * A two-dimensional point represented by an angle and a radius.
 *
 * The arithmetic and interpolation semantics intentionally match the legacy
 * JIT implementation, including its interpolation direction and angle wrap.
 */
export class Polar implements PolarCoordinates {
  static KER = new Polar(0, 0);

  theta: number;
  rho: number;

  constructor(theta?: number, rho?: number) {
    // Keep the legacy fallback semantics for NaN and negative zero as well as
    // omitted values.
    this.theta = theta || 0;
    this.rho = rho || 0;
  }

  getc(simple: true): CartesianCoordinates;
  getc(simple?: false): Complex;
  getc(simple?: boolean): Complex | CartesianCoordinates;
  getc(simple = false): Complex | CartesianCoordinates {
    return this.toComplex(simple);
  }

  getp(): this {
    return this;
  }

  set(value: PolarConvertible): void {
    const polar = value.getp();
    this.theta = polar.theta;
    this.rho = polar.rho;
  }

  setc(x: number, y: number): void {
    this.rho = Math.sqrt(x * x + y * y);
    this.theta = Math.atan2(y, x);
    if (this.theta < 0) {
      this.theta += Math.PI * 2;
    }
  }

  setp(theta: number, rho: number): void {
    this.theta = theta;
    this.rho = rho;
  }

  clone(): Polar {
    return new Polar(this.theta, this.rho);
  }

  toComplex(simple: true): CartesianCoordinates;
  toComplex(simple?: false): Complex;
  toComplex(simple?: boolean): Complex | CartesianCoordinates;
  toComplex(simple = false): Complex | CartesianCoordinates {
    const x = Math.cos(this.theta) * this.rho;
    const y = Math.sin(this.theta) * this.rho;
    return simple ? { x, y } : new Complex(x, y);
  }

  add(polar: PolarCoordinates): Polar {
    return new Polar(this.theta + polar.theta, this.rho + polar.rho);
  }

  scale(factor: number): Polar {
    return new Polar(this.theta, this.rho * factor);
  }

  equals(polar: PolarCoordinates): boolean {
    // Deliberately retain the legacy coercive comparison at the JS boundary.
    return this.theta == polar.theta && this.rho == polar.rho;
  }

  $add(polar: PolarCoordinates): this {
    this.theta += polar.theta;
    this.rho += polar.rho;
    return this;
  }

  $madd(polar: PolarCoordinates): this {
    this.theta = (this.theta + polar.theta) % (Math.PI * 2);
    this.rho += polar.rho;
    return this;
  }

  $scale(factor: number): this {
    this.rho *= factor;
    return this;
  }

  isZero(): boolean {
    const almostZero = 0.0001;
    return Math.abs(this.theta) < almostZero && Math.abs(this.rho) < almostZero;
  }

  interpolate(element: PolarCoordinates, delta: number): PolarCoordinates {
    const pi = Math.PI;
    const pi2 = pi * 2;
    const normalizeAngle = (theta: number): number =>
      theta < 0 ? (theta % pi2) + pi2 : theta % pi2;

    const theta = this.theta;
    const elementTheta = element.theta;
    const difference = Math.abs(theta - elementTheta);
    let interpolatedTheta: number;

    if (difference == pi) {
      if (theta > elementTheta) {
        interpolatedTheta = normalizeAngle(
          elementTheta + (theta - pi2 - elementTheta) * delta,
        );
      } else {
        interpolatedTheta = normalizeAngle(
          elementTheta - pi2 + (theta - elementTheta) * delta,
        );
      }
    } else if (difference >= pi) {
      if (theta > elementTheta) {
        interpolatedTheta = normalizeAngle(
          elementTheta + (theta - pi2 - elementTheta) * delta,
        );
      } else {
        interpolatedTheta = normalizeAngle(
          elementTheta - pi2 + (theta - (elementTheta - pi2)) * delta,
        );
      }
    } else {
      interpolatedTheta = normalizeAngle(
        elementTheta + (theta - elementTheta) * delta,
      );
    }

    return {
      theta: interpolatedTheta,
      rho: (this.rho - element.rho) * delta + element.rho,
    };
  }
}

/** A two-dimensional point represented by cartesian coordinates. */
export class Complex implements CartesianCoordinates {
  static KER = new Complex(0, 0);

  x: number;
  y: number;

  constructor(x?: number, y?: number) {
    // Keep the legacy fallback semantics for NaN and negative zero as well as
    // omitted values.
    this.x = x || 0;
    this.y = y || 0;
  }

  getc(_simple?: boolean): this {
    return this;
  }

  getp(simple: true): PolarCoordinates;
  getp(simple?: false): Polar;
  getp(simple?: boolean): Polar | PolarCoordinates;
  getp(simple = false): Polar | PolarCoordinates {
    return this.toPolar(simple);
  }

  set(value: CartesianConvertible): void {
    const cartesian = value.getc(true);
    this.x = cartesian.x;
    this.y = cartesian.y;
  }

  setc(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  setp(theta: number, rho: number): void {
    this.x = Math.cos(theta) * rho;
    this.y = Math.sin(theta) * rho;
  }

  clone(): Complex {
    return new Complex(this.x, this.y);
  }

  toPolar(simple: true): PolarCoordinates;
  toPolar(simple?: false): Polar;
  toPolar(simple?: boolean): Polar | PolarCoordinates;
  toPolar(simple = false): Polar | PolarCoordinates {
    const rho = this.norm();
    let theta = Math.atan2(this.y, this.x);
    if (theta < 0) {
      theta += Math.PI * 2;
    }
    return simple ? { theta, rho } : new Polar(theta, rho);
  }

  norm(): number {
    return Math.sqrt(this.squaredNorm());
  }

  squaredNorm(): number {
    return this.x * this.x + this.y * this.y;
  }

  add(position: CartesianCoordinates): Complex {
    return new Complex(this.x + position.x, this.y + position.y);
  }

  prod(position: CartesianCoordinates): Complex {
    return new Complex(
      this.x * position.x - this.y * position.y,
      this.y * position.x + this.x * position.y,
    );
  }

  conjugate(): Complex {
    return new Complex(this.x, -this.y);
  }

  scale(factor: number): Complex {
    return new Complex(this.x * factor, this.y * factor);
  }

  /**
   * Translate this point inside the unit disk. The argument mutation is an
   * intentional JIT 2.0.1 compatibility detail; callers normally pass a
   * freshly scaled vector.
   */
  moebiusTransformation(vector: Complex): Complex {
    const numerator = this.add(vector);
    const denominator = vector.$conjugate().$prod(this);
    denominator.x += 1;
    return numerator.$div(denominator);
  }

  equals(position: CartesianCoordinates): boolean {
    // Deliberately retain the legacy coercive comparison at the JS boundary.
    return this.x == position.x && this.y == position.y;
  }

  $add(position: CartesianCoordinates): this {
    this.x += position.x;
    this.y += position.y;
    return this;
  }

  $prod(position: CartesianCoordinates): this {
    const x = this.x;
    const y = this.y;
    this.x = x * position.x - y * position.y;
    this.y = y * position.x + x * position.y;
    return this;
  }

  $conjugate(): this {
    this.y = -this.y;
    return this;
  }

  $scale(factor: number): this {
    this.x *= factor;
    this.y *= factor;
    return this;
  }

  $div(position: Complex): this {
    const x = this.x;
    const y = this.y;
    const squaredNorm = position.squaredNorm();
    this.x = x * position.x + y * position.y;
    this.y = y * position.x - x * position.y;
    return this.$scale(1 / squaredNorm);
  }

  isZero(): boolean {
    const almostZero = 0.0001;
    return Math.abs(this.x) < almostZero && Math.abs(this.y) < almostZero;
  }
}
