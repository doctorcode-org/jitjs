import { Polar } from "../core/geometry.js";
import { hexToRgb, map, rgbToHex } from "../core/util.js";

export interface PieChartPoint {
  x: number;
  y: number;
}

export interface PieChartGradient {
  addColorStop(offset: number, color: string): void;
}

export interface PieChartRenderContext {
  fillStyle: unknown;
  strokeStyle: unknown;
  globalCompositeOperation: string;
  lineWidth: number;
  font: string;
  textBaseline: string;
  textAlign: string;
  createRadialGradient(
    x0: number,
    y0: number,
    radius0: number,
    x1: number,
    y1: number,
    radius1: number,
  ): PieChartGradient;
  beginPath(): void;
  arc(
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    counterclockwise?: boolean,
  ): void;
  closePath(): void;
  fill(): void;
  stroke(): void;
  fillText(text: unknown, x: number, y: number): void;
  save(): void;
  restore(): void;
}

export interface PieChartRenderCanvas<
  TContext extends PieChartRenderContext = PieChartRenderContext,
> {
  getCtx(): TContext;
}

export interface PieChartRenderPosition {
  theta: number;
  getp(simple: true): { theta: number; rho: number };
}

export interface PieChartRenderNode {
  name: string;
  pos: PieChartRenderPosition;
  _depth: number;
  getData<TValue = unknown>(property: string): TValue;
}

export interface PieChartRenderConfig {
  sliceOffset: number;
  labelOffset: number;
  showLabels: boolean;
  resizeLabels: boolean | number;
  Label: {
    type: string;
    color: string;
    style: string;
    size: number;
    family: string;
  };
}

export interface PieChartRendererHost<
  TNode extends PieChartRenderNode = PieChartRenderNode,
> {
  config: { levelDistance: number };
  angleContains(node: TNode, position: PieChartPoint): boolean;
}

export interface PieChartHit {
  name: string;
  color: string;
  value: number;
  label: string;
}

export interface PieChartNodeRenderer<
  TNode extends PieChartRenderNode = PieChartRenderNode,
  TCanvas extends PieChartRenderCanvas = PieChartRenderCanvas,
> {
  render(this: PieChartRendererHost<TNode>, node: TNode, canvas: TCanvas): void;
  contains(
    this: PieChartRendererHost<TNode>,
    node: TNode,
    position: PieChartPoint,
  ): PieChartHit | false;
}

/** Render the legacy `piechart-stacked` Sunburst node type. */
export function renderPieChartStackedNode<
  TNode extends PieChartRenderNode,
  TCanvas extends PieChartRenderCanvas,
>(
  this: PieChartRendererHost<TNode>,
  node: TNode,
  canvas: TCanvas,
): void {
  // JIT 2.0.1 performs this otherwise-unused conversion before rendering.
  node.pos.getp(true);
  const dimensions = node.getData<number[]>("dimArray");
  const values = node.getData<number[]>("valueArray");
  const colors = node.getData<string[]>("colorArray");
  const colorLength = colors.length;
  const strings = node.getData<string[]>("stringArray");
  const span = node.getData<number>("span") / 2;
  const theta = node.pos.theta;
  const begin = theta - span;
  const end = theta + span;
  const polar = new Polar();
  const context = canvas.getCtx();
  const selected: {
    accumulation?: number;
    dimension?: number;
    begin?: number;
    end?: number;
  } = {};
  const gradient = node.getData<unknown>("gradient");
  const border = node.getData<false | { name?: unknown; color?: unknown }>(
    "border",
  );
  const config = node.getData<PieChartRenderConfig>("config");
  const label = config.Label;
  const x = config.sliceOffset * Math.cos((begin + end) / 2);
  const y = config.sliceOffset * Math.sin((begin + end) / 2);

  if (colors && dimensions && strings) {
    let accumulation = 0;
    let valueAccumulation = 0;
    for (let index = 0; index < dimensions.length; index += 1) {
      const dimension = dimensions[index] as number;
      const color = colors[index % colorLength] as string;
      if (dimension <= 0) {
        continue;
      }
      context.fillStyle = context.strokeStyle = color;
      if (gradient && dimension) {
        const radial = context.createRadialGradient(
          x,
          y,
          accumulation + config.sliceOffset,
          x,
          y,
          accumulation + dimension + config.sliceOffset,
        );
        const rgb = hexToRgb(color) as readonly number[];
        const dark = rgbToHex(
          map(rgb, (component) => (component * 0.8) >> 0) as [
            number,
            number,
            number,
          ],
        ) as string;
        radial.addColorStop(0, color);
        radial.addColorStop(0.5, color);
        radial.addColorStop(1, dark);
        context.fillStyle = radial;
      }

      polar.rho = accumulation + config.sliceOffset;
      polar.theta = begin;
      polar.getc(true);
      polar.theta = end;
      polar.getc(true);
      polar.rho += dimension;
      polar.getc(true);
      polar.theta = begin;
      polar.getc(true);

      context.beginPath();
      context.arc(x, y, accumulation + 0.01, begin, end, false);
      context.arc(
        x,
        y,
        accumulation + dimension + 0.01,
        end,
        begin,
        true,
      );
      context.fill();
      if (border && border.name == strings[index]) {
        selected.accumulation = accumulation;
        selected.dimension = dimension;
        selected.begin = begin;
        selected.end = end;
      }
      accumulation += dimension || 0;
      valueAccumulation += values[index] || 0;
    }
    void valueAccumulation;

    if (border) {
      context.save();
      context.globalCompositeOperation = "source-over";
      context.lineWidth = 2;
      context.strokeStyle = border.color;
      const sign = begin < end ? 1 : -1;
      void sign;
      context.beginPath();
      context.arc(
        x,
        y,
        (selected.accumulation as number) + 0.01 + 1,
        selected.begin as number,
        selected.end as number,
        false,
      );
      context.arc(
        x,
        y,
        (selected.accumulation as number) +
          (selected.dimension as number) +
          0.01 -
          1,
        selected.end as number,
        selected.begin as number,
        true,
      );
      context.closePath();
      context.stroke();
      context.restore();
    }

    if (config.showLabels && label.type == "Native") {
      context.save();
      context.fillStyle = context.strokeStyle = label.color;
      const scale = config.resizeLabels
        ? node.getData<number>("normalizedDim")
        : 1;
      let fontSize = (label.size * scale) >> 0;
      fontSize =
        fontSize < +config.resizeLabels ? +config.resizeLabels : fontSize;
      context.font = `${label.style} ${fontSize}px ${label.family}`;
      context.textBaseline = "middle";
      context.textAlign = "center";
      polar.rho = accumulation + config.labelOffset + config.sliceOffset;
      polar.theta = node.pos.theta;
      const position = polar.getc(true);
      context.fillText(node.name, position.x, position.y);
      context.restore();
    }
  }
}

/** Hit-test the legacy `piechart-stacked` Sunburst node type. */
export function containsPieChartStackedNode<
  TNode extends PieChartRenderNode,
>(
  this: PieChartRendererHost<TNode>,
  node: TNode,
  position: PieChartPoint,
): PieChartHit | false {
  if (this.angleContains(node, position)) {
    const radius = Math.sqrt(
      position.x * position.x + position.y * position.y,
    );
    const config = node.getData<PieChartRenderConfig>("config");
    if (
      radius <=
      this.config.levelDistance * node._depth + config.sliceOffset
    ) {
      const dimensions = node.getData<number[]>("dimArray");
      let accumulation = config.sliceOffset;
      for (let index = 0; index < dimensions.length; index += 1) {
        const dimension = dimensions[index] as number;
        if (
          radius >= accumulation &&
          radius <= accumulation + dimension
        ) {
          return {
            name: node.getData<string[]>("stringArray")[index] as string,
            color: node.getData<string[]>("colorArray")[index] as string,
            value: node.getData<number[]>("valueArray")[index] as number,
            label: node.name,
          };
        }
        accumulation += dimension;
      }
    }
    return false;
  }
  return false;
}

/** Direct renderer value for composition without a global node-type registry. */
export const pieChartStackedNodeType: PieChartNodeRenderer = {
  render: renderPieChartStackedNode,
  contains: containsPieChartStackedNode,
};

export const pieChartStackedNodeRenderer = pieChartStackedNodeType;
