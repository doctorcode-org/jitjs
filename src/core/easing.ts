export type EasingFunction = (position: number) => number;

export type TransitionParameters = ReadonlyArray<number | null | undefined>;

export type EasingTransition = ((
  position: number,
  parameters?: TransitionParameters,
) => number) & {
  easeIn: EasingFunction;
  easeOut: EasingFunction;
  easeInOut: EasingFunction;
};

type BaseTransition = (
  position: number,
  parameters?: TransitionParameters,
) => number;

function withEasing(
  transition: BaseTransition,
  parameters?: number | TransitionParameters,
): EasingTransition {
  // Legacy `splat(undefined)` produces `[undefined]`, which matters for the
  // parameterized Pow, Back, and Elastic transitions.
  const easingParameters = (Array.isArray(parameters)
    ? parameters
    : [parameters]) as TransitionParameters;

  return Object.assign(transition, {
    easeIn(position: number): number {
      return transition(position, easingParameters);
    },

    easeOut(position: number): number {
      return 1 - transition(1 - position, easingParameters);
    },

    easeInOut(position: number): number {
      return position <= 0.5
        ? transition(2 * position, easingParameters) / 2
        : (2 - transition(2 * (1 - position), easingParameters)) / 2;
    },
  });
}

function powTransition(
  position: number,
  parameters?: TransitionParameters,
): number {
  // Calling the raw legacy transition without its parameter array throws,
  // while its easing methods always provide one.
  return Math.pow(position, parameters![0] || 6);
}

function expoTransition(position: number): number {
  return Math.pow(2, 8 * (position - 1));
}

function circTransition(position: number): number {
  return 1 - Math.sin(Math.acos(position));
}

function sineTransition(position: number): number {
  return 1 - Math.sin(((1 - position) * Math.PI) / 2);
}

function backTransition(
  position: number,
  parameters?: TransitionParameters,
): number {
  const distance = parameters![0] || 1.618;
  return Math.pow(position, 2) * ((distance + 1) * position - distance);
}

function bounceTransition(position: number): number {
  for (let a = 0, b = 1; ; a += b, b /= 2) {
    if (position >= (7 - 4 * a) / 11) {
      return b * b - Math.pow((11 - 6 * a - 11 * position) / 4, 2);
    }
  }
}

function elasticTransition(
  position: number,
  parameters?: TransitionParameters,
): number {
  position -= 1;
  return (
    Math.pow(2, 10 * position) *
    Math.cos((20 * position * Math.PI * (parameters![0] || 1)) / 3)
  );
}

function polynomialTransition(power: number): BaseTransition {
  return (position: number): number => Math.pow(position, power);
}

export function linear(position: number): number {
  return position;
}

export const Pow = /* @__PURE__ */ withEasing(powTransition);
export const Expo = /* @__PURE__ */ withEasing(expoTransition);
export const Circ = /* @__PURE__ */ withEasing(circTransition);
export const Sine = /* @__PURE__ */ withEasing(sineTransition);
export const Back = /* @__PURE__ */ withEasing(backTransition);
export const Bounce = /* @__PURE__ */ withEasing(bounceTransition);
export const Elastic = /* @__PURE__ */ withEasing(elasticTransition);
export const Quad = /* @__PURE__ */ withEasing(polynomialTransition(2));
export const Cubic = /* @__PURE__ */ withEasing(polynomialTransition(3));
export const Quart = /* @__PURE__ */ withEasing(polynomialTransition(4));
export const Quint = /* @__PURE__ */ withEasing(polynomialTransition(5));

/**
 * Namespace-style access for callers that need several transitions. Import an
 * individual transition from this module when bundle size is more important.
 */
export const Trans = {
  linear,
  Pow,
  Expo,
  Circ,
  Sine,
  Back,
  Bounce,
  Elastic,
  Quad,
  Cubic,
  Quart,
  Quint,
};
