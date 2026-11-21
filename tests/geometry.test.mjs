import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

import { Complex, Polar } from '../src/core/geometry.ts';

function loadLegacyGeometry() {
  const source = readFileSync(new URL('../jit.js', import.meta.url), 'utf8');
  const context = vm.createContext({ document: {} });
  context.window = context;
  vm.runInContext(source, context, { filename: 'jit.js' });
  return {
    Complex: context.$jit.Complex,
    Polar: context.$jit.Polar,
  };
}

const { Complex: LegacyComplex, Polar: LegacyPolar } = loadLegacyGeometry();

test('geometry module does not publish a legacy global', () => {
  assert.strictEqual(Object.hasOwn(globalThis, '$jit'), false);
});

function assertFields(modern, legacy, fields) {
  assert.deepStrictEqual(
    fields.map((field) => modern[field]),
    fields.map((field) => legacy[field]),
  );
}

function assertCartesian(modern, legacy) {
  assertFields(modern, legacy, ['x', 'y']);
}

function assertPolar(modern, legacy) {
  assertFields(modern, legacy, ['theta', 'rho']);
}

test('constructors and static kernels retain legacy values', () => {
  const values = [undefined, null, false, '', -0, Number.NaN, -3.5, 4, Infinity];

  for (const x of values) {
    for (const y of values) {
      assertCartesian(new Complex(x, y), new LegacyComplex(x, y));
      assertPolar(new Polar(x, y), new LegacyPolar(x, y));
    }
  }

  assertCartesian(Complex.KER, LegacyComplex.KER);
  assertPolar(Polar.KER, LegacyPolar.KER);
});

test('cartesian and polar conversions match in class and simple modes', () => {
  const cartesianCases = [
    [0, 0],
    [3, 4],
    [-2, 7],
    [-6, -8],
  ];

  for (const [x, y] of cartesianCases) {
    const modern = new Complex(x, y);
    const legacy = new LegacyComplex(x, y);
    assert.strictEqual(modern.getc(), modern);
    assert.strictEqual(legacy.getc(), legacy);
    assertPolar(modern.getp(), legacy.getp());
    assertPolar(modern.getp(true), legacy.getp(true));
    assertPolar(modern.toPolar(), legacy.toPolar());
    assertPolar(modern.toPolar(true), legacy.toPolar(true));
    assert.ok(modern.toPolar() instanceof Polar);
    assert.ok(!(modern.toPolar(true) instanceof Polar));
  }

  const polarCases = [
    [0, 0],
    [Math.PI / 3, 4],
    [-Math.PI / 2, 2],
    [Math.PI * 2, -3],
  ];

  for (const [theta, rho] of polarCases) {
    const modern = new Polar(theta, rho);
    const legacy = new LegacyPolar(theta, rho);
    assert.strictEqual(modern.getp(), modern);
    assert.strictEqual(legacy.getp(), legacy);
    assertCartesian(modern.getc(), legacy.getc());
    assertCartesian(modern.getc(true), legacy.getc(true));
    assertCartesian(modern.toComplex(), legacy.toComplex());
    assertCartesian(modern.toComplex(true), legacy.toComplex(true));
    assert.ok(modern.toComplex() instanceof Complex);
    assert.ok(!(modern.toComplex(true) instanceof Complex));
  }
});

test('setters and clones retain legacy mutation and return behavior', () => {
  const modernComplex = new Complex(1, 2);
  const legacyComplex = new LegacyComplex(1, 2);
  assert.strictEqual(modernComplex.set(new Polar(0.75, 8)), undefined);
  assert.strictEqual(legacyComplex.set(new LegacyPolar(0.75, 8)), undefined);
  assertCartesian(modernComplex, legacyComplex);
  modernComplex.setc(-4, 9);
  legacyComplex.setc(-4, 9);
  assertCartesian(modernComplex, legacyComplex);
  modernComplex.setp(Math.PI / 4, 12);
  legacyComplex.setp(Math.PI / 4, 12);
  assertCartesian(modernComplex, legacyComplex);
  assertCartesian(modernComplex.clone(), legacyComplex.clone());
  assert.notStrictEqual(modernComplex.clone(), modernComplex);

  const modernPolar = new Polar(1, 2);
  const legacyPolar = new LegacyPolar(1, 2);
  assert.strictEqual(modernPolar.set(new Complex(-4, 3)), undefined);
  assert.strictEqual(legacyPolar.set(new LegacyComplex(-4, 3)), undefined);
  assertPolar(modernPolar, legacyPolar);
  modernPolar.setc(-8, -6);
  legacyPolar.setc(-8, -6);
  assertPolar(modernPolar, legacyPolar);
  modernPolar.setp(5, 11);
  legacyPolar.setp(5, 11);
  assertPolar(modernPolar, legacyPolar);
  assertPolar(modernPolar.clone(), legacyPolar.clone());
  assert.notStrictEqual(modernPolar.clone(), modernPolar);
});

test('non-mutating complex arithmetic matches legacy behavior', () => {
  const modern = new Complex(3, -4);
  const legacy = new LegacyComplex(3, -4);
  const modernOperand = new Complex(-2, 5);
  const legacyOperand = new LegacyComplex(-2, 5);

  assertCartesian(modern.add(modernOperand), legacy.add(legacyOperand));
  assertCartesian(modern.prod(modernOperand), legacy.prod(legacyOperand));
  assertCartesian(modern.conjugate(), legacy.conjugate());
  assertCartesian(modern.scale(-2.5), legacy.scale(-2.5));
  assert.deepStrictEqual(
    [modern.norm(), modern.squaredNorm()],
    [legacy.norm(), legacy.squaredNorm()],
  );
  assertCartesian(modern, legacy);
});

test('mutating complex arithmetic matches legacy behavior and chains', () => {
  const operations = [
    [' $add', (value, operand) => value.$add(operand)],
    [' $prod', (value, operand) => value.$prod(operand)],
    [' $conjugate', (value) => value.$conjugate()],
    [' $scale', (value) => value.$scale(-0.75)],
    [' $div', (value, operand) => value.$div(operand)],
  ];

  for (const [name, operation] of operations) {
    const modern = new Complex(3, -4);
    const legacy = new LegacyComplex(3, -4);
    const modernResult = operation(modern, new Complex(-2, 5));
    const legacyResult = operation(legacy, new LegacyComplex(-2, 5));
    assert.strictEqual(modernResult, modern, `${name} should return this`);
    assert.strictEqual(legacyResult, legacy, `${name} legacy should return this`);
    assertCartesian(modern, legacy);
  }

  const modernZeroDivision = new Complex(1, 1).$div(new Complex(0, 0));
  const legacyZeroDivision = new LegacyComplex(1, 1).$div(
    new LegacyComplex(0, 0),
  );
  assertCartesian(modernZeroDivision, legacyZeroDivision);
});

test('polar arithmetic and mutators match legacy behavior', () => {
  const modern = new Polar(5.8, 4);
  const legacy = new LegacyPolar(5.8, 4);
  const modernOperand = new Polar(1.2, -3);
  const legacyOperand = new LegacyPolar(1.2, -3);

  assertPolar(modern.add(modernOperand), legacy.add(legacyOperand));
  assertPolar(modern.scale(-2), legacy.scale(-2));

  for (const operation of [
    (value, operand) => value.$add(operand),
    (value, operand) => value.$madd(operand),
    (value) => value.$scale(-0.5),
  ]) {
    const modernValue = modern.clone();
    const legacyValue = legacy.clone();
    const modernResult = operation(modernValue, modernOperand);
    const legacyResult = operation(legacyValue, legacyOperand);
    assert.strictEqual(modernResult, modernValue);
    assert.strictEqual(legacyResult, legacyValue);
    assertPolar(modernValue, legacyValue);
  }
});

test('equality and zero thresholds preserve legacy edge behavior', () => {
  for (const [x, y] of [
    [0, 0],
    [0.000099, -0.000099],
    [0.0001, 0],
    [-0.0001, 0],
  ]) {
    assert.strictEqual(
      new Complex(x, y).isZero(),
      new LegacyComplex(x, y).isZero(),
    );
    assert.strictEqual(new Polar(x, y).isZero(), new LegacyPolar(x, y).isZero());
  }

  const modernComplex = new Complex(2, 3);
  const legacyComplex = new LegacyComplex(2, 3);
  const modernPolar = new Polar(2, 3);
  const legacyPolar = new LegacyPolar(2, 3);
  assert.strictEqual(modernComplex.equals({ x: '2', y: '3' }), true);
  assert.strictEqual(
    modernComplex.equals({ x: '2', y: '3' }),
    legacyComplex.equals({ x: '2', y: '3' }),
  );
  assert.strictEqual(modernPolar.equals({ theta: '2', rho: '3' }), true);
  assert.strictEqual(
    modernPolar.equals({ theta: '2', rho: '3' }),
    legacyPolar.equals({ theta: '2', rho: '3' }),
  );
});

test('polar interpolation follows the same wrap and direction rules', () => {
  const cases = [
    [0, Math.PI],
    [Math.PI, 0],
    [5.8, 0.2],
    [0.2, 5.8],
    [1, 2],
    [-1, 2.5],
  ];

  for (const [theta, targetTheta] of cases) {
    for (const delta of [0, 0.25, 0.5, 1, 1.5]) {
      const modern = new Polar(theta, 9).interpolate(
        new Polar(targetTheta, -3),
        delta,
      );
      const legacy = new LegacyPolar(theta, 9).interpolate(
        new LegacyPolar(targetTheta, -3),
        delta,
      );
      assertPolar(modern, legacy);
    }
  }
});
