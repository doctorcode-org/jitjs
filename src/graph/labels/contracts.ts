export interface LabelCoordinates {
  x: number;
  y: number;
}

export interface LabelPosition {
  getc(simple: true): LabelCoordinates;
}

/** Minimal graph-node surface consumed by label implementations. */
export interface LabelNode {
  id: string;
  name: string;
  pos: LabelPosition;
  getData<TValue = unknown>(property: string): TValue;
  getLabelData<TValue = unknown>(property: string): TValue;
}

export interface LabelCanvas {
  getCtx(): CanvasRenderingContext2D;
  getSize(): { width: number; height: number };
}

export interface TransformedLabelCanvas extends LabelCanvas {
  translateOffsetX: number;
  translateOffsetY: number;
  scaleOffsetX: number;
  scaleOffsetY: number;
}

export interface LabelController<
  TNode extends LabelNode = LabelNode,
  TElement extends Element = Element,
> {
  onCreateLabel?(element: TElement, node: TNode): void;
  onPlaceLabel?(element: TElement, node: TNode): void;
}

export interface LabelDocument {
  createElement(tagName: string): HTMLElement;
  createElementNS(namespace: string, qualifiedName: string): Element;
  getElementById(id: string): Element | null;
}

export type LabelContainer = HTMLElement | SVGElement;
