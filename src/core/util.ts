const objectToString = Object.prototype.toString;

export type LegacyType =
  | "arguments"
  | "array"
  | "boolean"
  | "date"
  | "element"
  | "error"
  | "function"
  | "map"
  | "null"
  | "number"
  | "object"
  | "regexp"
  | "set"
  | "string"
  | "symbol"
  | "undefined"
  | "weakmap"
  | "weakset"
  | (string & {});

export type Rgb = readonly [red: number, green: number, blue: number];

export type RgbArray =
  | Rgb
  | readonly [red: number, green: number, blue: number, alpha: number];

export type HexTriplet = [red: string, green: string, blue: string];

type AnyFunction = (...args: never[]) => unknown;

type UnionToIntersection<T> = (
  T extends unknown ? (value: T) => void : never
) extends (value: infer TIntersection) => void
  ? TIntersection
  : never;

interface LegacyFamilyValue {
  $$family?: string;
  nodeName?: string;
  nodeType?: number;
}

export function empty(): void {}

export function extend<TOriginal extends object, TExtended extends object>(
  original: TOriginal,
  extended?: TExtended,
): TOriginal & TExtended {
  const extension = (extended || {}) as Record<string, unknown>;
  for (const key in extension) {
    (original as Record<string, unknown>)[key] = extension[key];
  }

  return original as TOriginal & TExtended;
}

export function lambda<TArgs extends readonly unknown[], TResult>(
  value: (...args: TArgs) => TResult,
): (...args: TArgs) => TResult;
export function lambda<TValue>(value: TValue): () => TValue;
export function lambda(value: unknown): AnyFunction | (() => unknown) {
  if (typeof value === "function") {
    return value as AnyFunction;
  }

  return () => value;
}

export const time: () => number = Date.now;

export function typeOf(value: unknown): LegacyType {
  const match = objectToString.call(value).match(/^\[object\s(.*)\]$/);
  const type = (match?.[1] ?? "").toLowerCase();

  if (type !== "object") {
    return type;
  }

  const candidate = value as LegacyFamilyValue | null;
  if (candidate?.$$family) {
    return candidate.$$family;
  }

  return candidate?.nodeName && candidate.nodeType === 1 ? "element" : type;
}

export function splat<TValue>(value: TValue | readonly TValue[]): TValue[] {
  return typeOf(value) === "array" ? (value as TValue[]) : [value as TValue];
}

export function each<TValue>(
  iterable: ArrayLike<TValue> | Record<string, TValue>,
  callback: (value: TValue, key: number | string) => void,
): void {
  if (typeOf(iterable) === "object") {
    for (const key in iterable) {
      callback((iterable as Record<string, TValue>)[key] as TValue, key);
    }
    return;
  }

  const arrayLike = iterable as ArrayLike<TValue>;
  for (let index = 0; index < arrayLike.length; index += 1) {
    callback(arrayLike[index] as TValue, index);
  }
}

export function indexOf<TValue>(array: ArrayLike<TValue>, item: TValue): number {
  for (let index = 0; index < array.length; index += 1) {
    if (array[index] === item) {
      return index;
    }
  }

  return -1;
}

export function map<TValue, TResult>(
  iterable: ArrayLike<TValue> | Record<string, TValue>,
  callback: (value: TValue, key: number | string) => TResult,
): TResult[] {
  const result: TResult[] = [];
  each(iterable, (value, key) => {
    result.push(callback(value, key));
  });
  return result;
}

export function reduce<TValue>(
  array: ArrayLike<TValue>,
  callback: (accumulator: TValue, value: TValue) => TValue,
): TValue | undefined;
export function reduce<TValue, TResult>(
  array: ArrayLike<TValue>,
  callback: (accumulator: TResult, value: TValue) => TResult,
  initialValue: TResult,
): TResult;
export function reduce<TValue, TResult>(
  array: ArrayLike<TValue>,
  callback: (accumulator: TValue | TResult, value: TValue) => TValue | TResult,
  initialValue?: TResult,
): TValue | TResult | undefined {
  let length = array.length;
  if (length === 0) {
    return initialValue;
  }

  let accumulator: TValue | TResult =
    arguments.length === 3 ? (initialValue as TResult) : (array[--length] as TValue);

  while (length > 0) {
    length -= 1;
    accumulator = callback(accumulator, array[length] as TValue);
  }

  return accumulator;
}

export function unlink<TValue>(value: TValue): TValue {
  switch (typeOf(value)) {
    case "object": {
      const result: Record<string, unknown> = {};
      for (const key in value as object) {
        result[key] = unlink((value as Record<string, unknown>)[key]);
      }
      return result as TValue;
    }
    case "array": {
      const source = value as unknown[];
      const result: unknown[] = [];
      for (let index = 0; index < source.length; index += 1) {
        result[index] = unlink(source[index]);
      }
      return result as TValue;
    }
    default:
      return value;
  }
}

export function merge<const TSources extends readonly unknown[]>(
  ...sources: TSources
): UnionToIntersection<Extract<TSources[number], object>> {
  const result: Record<string, unknown> = {};

  for (const source of sources) {
    if (typeOf(source) !== "object") {
      continue;
    }

    for (const key in source as object) {
      const incoming = (source as Record<string, unknown>)[key];
      const current = result[key];
      result[key] =
        current && typeOf(incoming) === "object" && typeOf(current) === "object"
          ? merge(current, incoming)
          : unlink(incoming);
    }
  }

  return result as UnionToIntersection<Extract<TSources[number], object>>;
}

export function zip<const TArrays extends readonly (readonly unknown[])[]>(
  ...arrays: TArrays
): Array<{
  [TIndex in keyof TArrays]: TArrays[TIndex] extends readonly (infer TValue)[]
    ? TValue | undefined
    : never;
}> {
  if (arrays.length === 0) {
    return [];
  }

  const result: unknown[][] = [];
  const rowCount = arrays[0]?.length ?? 0;
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const row: unknown[] = [];
    for (const array of arrays) {
      row.push(array[rowIndex]);
    }
    result.push(row);
  }

  return result as Array<{
    [TIndex in keyof TArrays]: TArrays[TIndex] extends readonly (infer TValue)[]
      ? TValue | undefined
      : never;
  }>;
}

export function rgbToHex(source: RgbArray, asArray: true): HexTriplet | null;
export function rgbToHex(source: RgbArray, asArray?: false): string | null;
export function rgbToHex(
  source: RgbArray,
  asArray = false,
): HexTriplet | string | null {
  if (source.length < 3) {
    return null;
  }

  if (source.length === 4 && source[3] === 0 && !asArray) {
    return "transparent";
  }

  const hex = source.slice(0, 3).map((component) => {
    const value = Number(component).toString(16);
    return value.length === 1 ? `0${value}` : value;
  }) as HexTriplet;

  return asArray ? hex : `#${hex.join("")}`;
}

export function hexToRgb(hex: string): Rgb | null {
  if (hex.length === 7) {
    const value = Number.parseInt(hex.slice(1), 16);
    return [value >> 16, (value >> 8) & 0xff, value & 0xff];
  }

  const components = hex.match(/^#?(\w{1,2})(\w{1,2})(\w{1,2})$/);
  if (!components) {
    return null;
  }

  const rgb = components.slice(1).map((component) => {
    const normalized = component.length === 1 ? `${component}${component}` : component;
    return Number.parseInt(normalized, 16);
  });

  return rgb.length === 3 ? (rgb as [number, number, number]) : null;
}
