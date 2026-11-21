import { hexToRgb, map, rgbToHex } from "../core/util.js";

export interface BarChartPoint {
  x: number;
  y: number;
}

export interface BarChartGradient {
  addColorStop(offset: number, color: string): void;
}

/** The canvas subset used by the two legacy bar renderers. */
export interface BarChartRenderContext {
  fillStyle: unknown;
  strokeStyle: unknown;
  lineWidth: number;
  font: string;
  textBaseline: string;
  textAlign: string;
  createLinearGradient(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ): BarChartGradient;
  fillRect(x: number, y: number, width: number, height: number): void;
  strokeRect(x: number, y: number, width: number, height: number): void;
  fillText(text: unknown, x: number, y: number): void;
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  rotate(angle: number): void;
}

export interface BarChartRenderCanvas<
  TContext extends BarChartRenderContext = BarChartRenderContext,
> {
  getCtx(): TContext;
}

export interface BarChartRenderPosition {
  getc(simple: true): BarChartPoint;
}

export interface BarChartRenderNode {
  name: string;
  pos: BarChartRenderPosition;
  getData<TValue = unknown>(property: string): TValue;
}

export interface BarChartLabelConfig {
  type: string;
  color: string;
  style: string;
  size: number;
  family: string;
}

export type BarChartDisplayValue = boolean | string | number;

export type BarChartDisplayCallback<TNode extends BarChartRenderNode> = (
  name: string,
  value: number,
  node: TNode,
) => BarChartDisplayValue;

export interface BarChartRenderConfig<TNode extends BarChartRenderNode> {
  orientation: string;
  labelOffset: number;
  showAggregates: BarChartDisplayCallback<TNode>;
  showLabels: BarChartDisplayCallback<TNode>;
  Label: BarChartLabelConfig;
}

export interface BarChartRendererHost {
  getAlignedPos(
    position: BarChartPoint,
    width: number,
    height: number,
  ): BarChartPoint;
}

export interface BarChartHit {
  name: unknown;
  color: unknown;
  value: unknown;
  label: string;
}

export interface BarChartNodeRenderer<
  TNode extends BarChartRenderNode = BarChartRenderNode,
  TCanvas extends BarChartRenderCanvas = BarChartRenderCanvas,
> {
  render(this: BarChartRendererHost, node: TNode, canvas: TCanvas): void;
  contains(
    this: BarChartRendererHost,
    node: TNode,
    position: BarChartPoint,
  ): BarChartHit | false;
}

function darkerColor(color: string): string {
  // Keep the 2.0.1 conversion path, including its truncation through a bitwise
  // operation and its lower-case hexadecimal output.
  const rgb = hexToRgb(color.slice(1)) as readonly number[];
  return rgbToHex(
    map(rgb, (component) => (component * 0.5) >> 0) as [
      number,
      number,
      number,
    ],
  ) as string;
}

function nativeLabels<TNode extends BarChartRenderNode>(
  context: BarChartRenderContext,
  node: TNode,
  config: BarChartRenderConfig<TNode>,
  horizontal: boolean,
  x: number,
  y: number,
  width: number,
  height: number,
  dimensions: readonly number[],
  dimensionTotal: number,
  valueTotal: number,
  grouped: boolean,
): void {
  const label = config.Label;
  if (label.type != "Native") {
    return;
  }

  context.save();
  context.fillStyle = context.strokeStyle = label.color;
  context.font = `${label.style} ${label.size}px ${label.family}`;
  context.textBaseline = "middle";

  let aggregate = config.showAggregates(node.name, valueTotal, node);
  if (aggregate !== false) {
    aggregate = aggregate !== true ? aggregate : valueTotal;
    if (horizontal) {
      context.textAlign = "right";
      const end = grouped
        ? Math.max.apply(null, dimensions as number[])
        : dimensionTotal;
      context.fillText(
        aggregate,
        x + end - config.labelOffset,
        y + height / 2,
      );
    } else {
      context.textAlign = "center";
      const extent = grouped
        ? Math.max.apply(null, dimensions as number[])
        : height;
      context.fillText(
        aggregate,
        x + width / 2,
        y - extent - label.size / 2 - config.labelOffset,
      );
    }
  }

  if (config.showLabels(node.name, valueTotal, node)) {
    if (horizontal) {
      context.textAlign = "center";
      context.translate(
        x - config.labelOffset - label.size / 2,
        y + height / 2,
      );
      context.rotate(Math.PI / 2);
      context.fillText(node.name, 0, 0);
    } else {
      context.textAlign = "center";
      context.fillText(
        node.name,
        x + width / 2,
        y + label.size / 2 + config.labelOffset,
      );
    }
  }
  context.restore();
}

/** Render the `barchart-stacked` node type from JIT 2.0.1. */
export function renderBarChartStackedNode<
  TNode extends BarChartRenderNode,
  TCanvas extends BarChartRenderCanvas,
>(
  this: BarChartRendererHost,
  node: TNode,
  canvas: TCanvas,
): void {
  const position = node.pos.getc(true);
  const width = node.getData<number>("width");
  const height = node.getData<number>("height");
  const aligned = this.getAlignedPos(position, width, height);
  const x = aligned.x;
  const y = aligned.y;
  const dimensions = node.getData<number[]>("dimArray");
  const values = node.getData<number[]>("valueArray");
  const colors = node.getData<string[]>("colorArray");
  const colorLength = colors.length;
  const strings = node.getData<unknown[]>("stringArray");
  const context = canvas.getCtx();
  const border = node.getData<false | { name?: unknown; color?: unknown }>(
    "border",
  );
  const gradient = node.getData<unknown>("gradient");
  const config = node.getData<BarChartRenderConfig<TNode>>("config");
  const horizontal = config.orientation == "horizontal";
  const selected: { accumulation?: number; dimension?: number } = {};

  if (colors && dimensions && strings) {
    let accumulation = 0;
    let valueTotal = 0;
    for (let index = 0; index < dimensions.length; index += 1) {
      const dimension = dimensions[index] as number;
      const color = colors[index % colorLength] as string;
      context.fillStyle = context.strokeStyle = color;
      if (gradient) {
        const linear = horizontal
          ? context.createLinearGradient(
              x + accumulation + dimension / 2,
              y,
              x + accumulation + dimension / 2,
              y + height,
            )
          : context.createLinearGradient(
              x,
              y - accumulation - dimension / 2,
              x + width,
              y - accumulation - dimension / 2,
            );
        const dark = darkerColor(color);
        linear.addColorStop(0, dark);
        linear.addColorStop(0.5, color);
        linear.addColorStop(1, dark);
        context.fillStyle = linear;
      }

      if (horizontal) {
        context.fillRect(x + accumulation, y, dimension, height);
      } else {
        context.fillRect(x, y - accumulation - dimension, width, dimension);
      }
      if (border && border.name == strings[index]) {
        selected.accumulation = accumulation;
        selected.dimension = dimension;
      }
      accumulation += dimension || 0;
      valueTotal += (values[index] as number) || 0;
    }

    if (border) {
      context.save();
      context.lineWidth = 2;
      context.strokeStyle = border.color;
      if (horizontal) {
        context.strokeRect(
          x + (selected.accumulation as number) + 1,
          y + 1,
          (selected.dimension as number) - 2,
          height - 2,
        );
      } else {
        context.strokeRect(
          x + 1,
          y -
            (selected.accumulation as number) -
            (selected.dimension as number) +
            1,
          width - 2,
          (selected.dimension as number) - 2,
        );
      }
      context.restore();
    }

    nativeLabels(
      context,
      node,
      config,
      horizontal,
      x,
      y,
      width,
      height,
      dimensions,
      accumulation,
      valueTotal,
      false,
    );
  }
}

/** Hit-test the `barchart-stacked` node type from JIT 2.0.1. */
export function containsBarChartStackedNode<TNode extends BarChartRenderNode>(
  this: BarChartRendererHost,
  node: TNode,
  mousePosition: BarChartPoint,
): BarChartHit | false {
  const position = node.pos.getc(true);
  const width = node.getData<number>("width");
  const height = node.getData<number>("height");
  const aligned = this.getAlignedPos(position, width, height);
  const x = aligned.x;
  const y = aligned.y;
  const dimensions = node.getData<number[]>("dimArray");
  const config = node.getData<BarChartRenderConfig<TNode>>("config");
  const horizontal = config.orientation == "horizontal";

  if (horizontal) {
    if (
      mousePosition.x < x ||
      mousePosition.x > x + width ||
      mousePosition.y > y + height ||
      mousePosition.y < y
    ) {
      return false;
    }
  } else if (
    mousePosition.x < x ||
    mousePosition.x > x + width ||
    mousePosition.y > y ||
    mousePosition.y < y - height
  ) {
    return false;
  }

  let accumulation = horizontal ? x : y;
  for (let index = 0; index < dimensions.length; index += 1) {
    const dimension = dimensions[index] as number;
    if (horizontal) {
      accumulation += dimension;
      if (mousePosition.x <= accumulation) {
        return hit(node, index);
      }
    } else {
      accumulation -= dimension;
      if (mousePosition.y >= accumulation) {
        return hit(node, index);
      }
    }
  }
  return false;
}

/** Render the `barchart-grouped` node type from JIT 2.0.1. */
export function renderBarChartGroupedNode<
  TNode extends BarChartRenderNode,
  TCanvas extends BarChartRenderCanvas,
>(
  this: BarChartRendererHost,
  node: TNode,
  canvas: TCanvas,
): void {
  const position = node.pos.getc(true);
  const width = node.getData<number>("width");
  const height = node.getData<number>("height");
  const aligned = this.getAlignedPos(position, width, height);
  const x = aligned.x;
  const y = aligned.y;
  const dimensions = node.getData<number[]>("dimArray");
  const values = node.getData<number[]>("valueArray");
  const valueLength = values.length;
  const colors = node.getData<string[]>("colorArray");
  const colorLength = colors.length;
  const strings = node.getData<unknown[]>("stringArray");
  const context = canvas.getCtx();
  const border = node.getData<false | { name?: unknown; color?: unknown }>(
    "border",
  );
  const gradient = node.getData<unknown>("gradient");
  const config = node.getData<BarChartRenderConfig<TNode>>("config");
  const horizontal = config.orientation == "horizontal";
  const fixedDimension = (horizontal ? height : width) / valueLength;
  const selected: { accumulation?: number; dimension?: number } = {};

  if (colors && dimensions && strings) {
    let accumulation = 0;
    let valueTotal = 0;
    for (let index = 0; index < valueLength; index += 1) {
      const dimension = dimensions[index] as number;
      const color = colors[index % colorLength] as string;
      context.fillStyle = context.strokeStyle = color;
      if (gradient) {
        const linear = horizontal
          ? context.createLinearGradient(
              x + dimension / 2,
              y + fixedDimension * index,
              x + dimension / 2,
              y + fixedDimension * (index + 1),
            )
          : context.createLinearGradient(
              x + fixedDimension * index,
              y - dimension / 2,
              x + fixedDimension * (index + 1),
              y - dimension / 2,
            );
        const dark = darkerColor(color);
        linear.addColorStop(0, dark);
        linear.addColorStop(0.5, color);
        linear.addColorStop(1, dark);
        context.fillStyle = linear;
      }

      if (horizontal) {
        context.fillRect(
          x,
          y + fixedDimension * index,
          dimension,
          fixedDimension,
        );
      } else {
        context.fillRect(
          x + fixedDimension * index,
          y - dimension,
          fixedDimension,
          dimension,
        );
      }
      if (border && border.name == strings[index]) {
        selected.accumulation = fixedDimension * index;
        selected.dimension = dimension;
      }
      accumulation += dimension || 0;
      valueTotal += (values[index] as number) || 0;
    }

    if (border) {
      context.save();
      context.lineWidth = 2;
      context.strokeStyle = border.color;
      if (horizontal) {
        context.strokeRect(
          x + 1,
          y + (selected.accumulation as number) + 1,
          (selected.dimension as number) - 2,
          fixedDimension - 2,
        );
      } else {
        context.strokeRect(
          x + (selected.accumulation as number) + 1,
          y - (selected.dimension as number) + 1,
          fixedDimension - 2,
          (selected.dimension as number) - 2,
        );
      }
      context.restore();
    }

    nativeLabels(
      context,
      node,
      config,
      horizontal,
      x,
      y,
      width,
      height,
      dimensions,
      accumulation,
      valueTotal,
      true,
    );
  }
}

/** Hit-test the `barchart-grouped` node type from JIT 2.0.1. */
export function containsBarChartGroupedNode<TNode extends BarChartRenderNode>(
  this: BarChartRendererHost,
  node: TNode,
  mousePosition: BarChartPoint,
): BarChartHit | false {
  const position = node.pos.getc(true);
  const width = node.getData<number>("width");
  const height = node.getData<number>("height");
  const aligned = this.getAlignedPos(position, width, height);
  const x = aligned.x;
  const y = aligned.y;
  const dimensions = node.getData<number[]>("dimArray");
  const config = node.getData<BarChartRenderConfig<TNode>>("config");
  const horizontal = config.orientation == "horizontal";
  const fixedDimension =
    (horizontal ? height : width) / dimensions.length;

  if (horizontal) {
    if (
      mousePosition.x < x ||
      mousePosition.x > x + width ||
      mousePosition.y > y + height ||
      mousePosition.y < y
    ) {
      return false;
    }
  } else if (
    mousePosition.x < x ||
    mousePosition.x > x + width ||
    mousePosition.y > y ||
    mousePosition.y < y - height
  ) {
    return false;
  }

  for (let index = 0; index < dimensions.length; index += 1) {
    const dimension = dimensions[index] as number;
    if (horizontal) {
      const limit = y + fixedDimension * index;
      if (
        mousePosition.x <= x + dimension &&
        mousePosition.y >= limit &&
        mousePosition.y <= limit + fixedDimension
      ) {
        return hit(node, index);
      }
    } else {
      const limit = x + fixedDimension * index;
      if (
        mousePosition.x >= limit &&
        mousePosition.x <= limit + fixedDimension &&
        mousePosition.y >= y - dimension
      ) {
        return hit(node, index);
      }
    }
  }
  return false;
}

function hit<TNode extends BarChartRenderNode>(
  node: TNode,
  index: number,
): BarChartHit {
  return {
    name: node.getData<unknown[]>("stringArray")[index],
    color: node.getData<unknown[]>("colorArray")[index],
    value: node.getData<unknown[]>("valueArray")[index],
    label: node.name,
  };
}

/** Direct renderer values for composition without a global node-type registry. */
export const barChartStackedNodeType: BarChartNodeRenderer = {
  render: renderBarChartStackedNode,
  contains: containsBarChartStackedNode,
};

export const barChartGroupedNodeType: BarChartNodeRenderer = {
  render: renderBarChartGroupedNode,
  contains: containsBarChartGroupedNode,
};

/** Descriptive aliases retained for consumers that call composed values renderers. */
export const barChartStackedNodeRenderer = barChartStackedNodeType;
export const barChartGroupedNodeRenderer = barChartGroupedNodeType;
