import type {
  LabelCanvas,
  LabelController,
  LabelNode,
} from "../graph/labels/contracts.js";

export interface SunburstLabelPolarCoordinates {
  theta: number;
  rho: number;
}

/** Polar position surface consumed by Sunburst's three label backends. */
export interface SunburstLabelPosition {
  theta: number;
  rho: number;
  clone(): SunburstLabelPosition;
  getc(simple: true): { x: number; y: number };
  getp(simple: true): SunburstLabelPolarCoordinates;
}

/** Minimal graph-node surface used by the legacy Sunburst label adapters. */
export interface SunburstLabelNode extends LabelNode {
  _depth: number;
  pos: SunburstLabelPosition;
}

export type SunburstLabelCanvas = LabelCanvas;

export interface SunburstLabelConfig {
  levelDistance: number;
}

/**
 * Mutable visualization state is injected instead of reading `$jit.Sunburst`.
 * Keeping the object by reference means root and config changes remain visible.
 */
export interface SunburstLabelState {
  root: string;
  config: SunburstLabelConfig;
}

export interface SunburstNativeLabelController {
  levelDistance: number;
}

export interface SunburstDOMLabelController<
  TNode extends SunburstLabelNode = SunburstLabelNode,
  TElement extends Element = Element,
> extends LabelController<TNode, TElement> {
  onPlaceLabel(element: TElement, node: TNode): void;
}
