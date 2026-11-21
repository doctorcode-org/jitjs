import { reduce, rgbToHex } from "../core/util.js";
import type { CartesianCoordinates } from "../core/geometry.js";
import type {
  AreaChartContainedValue,
  AreaChartNode,
  AreaChartValuePair,
} from "./area-chart.js";
import type {
  AreaChartRenderCanvas,
  AreaChartRendererContext,
} from "./area-chart-renderers.js";

export interface StreamChartCanvas extends AreaChartRenderCanvas {
  getSize(): { width: number; height: number };
}

export interface StreamChartGraph {
  getByName(name: string): AreaChartNode | false | null | undefined;
}

export interface StreamChartRendererContext extends AreaChartRendererContext {
  graph: StreamChartGraph;
  canvas: StreamChartCanvas;
}

export interface StreamChartNodeRenderer {
  render(
    this: StreamChartRendererContext,
    node: AreaChartNode,
    canvas: StreamChartCanvas,
  ): void;
  contains(
    this: StreamChartRendererContext,
    node: AreaChartNode,
    mousePosition: CartesianCoordinates,
  ): AreaChartContainedValue | false;
}

type StreamPoint = [x: number, y: number];

export function setStreamChartPositions(
  this: AreaChartRendererContext,
  node: AreaChartNode,
): void {
  const position = node.pos.getc(true);
  const width = node.getData<number>("width");
  const height = node.getData<number>("height");
  const aligned = this.getAlignedPos(position, width, height);
  const x = aligned.x;
  const y = aligned.y + height;
  const dimensions = node.getData<AreaChartValuePair[]>("dimArray");
  const heightLeft = reduce(dimensions, (total, value) => total + value[0], 0);
  const heightRight = reduce(dimensions, (total, value) => total + value[1], 0);
  const offsetHeight = (heightLeft - heightRight) / 2;
  const left: StreamPoint[] = [];
  const right: StreamPoint[] = [];
  let accumulatedLeft = 0;
  let accumulatedRight = 0;

  for (const dimension of dimensions) {
    if (heightLeft >= heightRight) {
      left.push([x, y - accumulatedLeft]);
      right.push([x + width, y - accumulatedRight - offsetHeight]);
      right.push([
        x + width,
        y - accumulatedRight - dimension[1] - offsetHeight,
      ]);
      left.push([x, y - accumulatedLeft - dimension[0]]);
    } else {
      left.push([x, y - accumulatedLeft + offsetHeight]);
      right.push([x + width, y - accumulatedRight]);
      right.push([x + width, y - accumulatedRight - dimension[1]]);
      left.push([x, y - accumulatedLeft - dimension[0] + offsetHeight]);
    }
    accumulatedLeft += dimension[0] || 0;
    accumulatedRight += dimension[1] || 0;
  }

  node.setData("left-pos", left);
  node.setData("right-pos", right);
}

function extendedBoundaries(
  context: StreamChartRendererContext,
  node: AreaChartNode,
  width: number,
  leftCurrent: StreamPoint[],
  rightCurrent: StreamPoint[],
): { left: StreamPoint[]; right: StreamPoint[] } {
  const previousName = node.getData<string | false>("prev");
  const nextName = node.getData<string | false>("next");
  const previous = previousName ? context.graph.getByName(previousName) : false;
  const next = nextName ? context.graph.getByName(nextName) : false;
  if (previous && next) {
    setStreamChartPositions.call(context, previous);
    setStreamChartPositions.call(context, next);
    return {
      left: previous.getData<StreamPoint[]>("left-pos"),
      right: next.getData<StreamPoint[]>("right-pos"),
    };
  }
  return {
    left: leftCurrent.map(([x, y]) => [x - width, y]),
    right: rightCurrent.map(([x, y]) => [x + width, y]),
  };
}

function bezierControls(
  left: StreamPoint[],
  leftCurrent: StreamPoint[],
  rightCurrent: StreamPoint[],
  right: StreamPoint[],
): [number, number, number, number][] {
  return left.map((_, index) => {
    const [x1, y1] = leftCurrent[index]!;
    const [x2, y2] = rightCurrent[index]!;
    const [x0, y0] = left[index]!;
    const [x3, y3] = right[index]!;
    const xc1 = (x0 + x1) / 2;
    const yc1 = (y0 + y1) / 2;
    const xc2 = (x1 + x2) / 2;
    const yc2 = (y1 + y2) / 2;
    const xc3 = (x2 + x3) / 2;
    const yc3 = (y2 + y3) / 2;
    const length1 = Math.hypot(x1 - x0, y1 - y0);
    const length2 = Math.hypot(x2 - x1, y2 - y1);
    const length3 = Math.hypot(x3 - x2, y3 - y2);
    const weight1 = length1 / (length1 + length2);
    const weight2 = length2 / (length2 + length3);
    const xm1 = xc1 + (xc2 - xc1) * weight1;
    const ym1 = yc1 + (yc2 - yc1) * weight1;
    const xm2 = xc2 + (xc3 - xc2) * weight2;
    const ym2 = yc2 + (yc3 - yc2) * weight2;
    const smoothness = 0.8;
    return [
      xm1 + (xc2 - xm1) * smoothness + x1 - xm1,
      ym1 + (yc2 - ym1) * smoothness + y1 - ym1,
      xm2 + (xc2 - xm2) * smoothness + x2 - xm2,
      ym2 + (yc2 - ym2) * smoothness + y2 - ym2,
    ];
  });
}

export function renderStreamChartSmoothNode(
  this: StreamChartRendererContext,
  node: AreaChartNode,
  canvas: StreamChartCanvas,
): void {
  const width = node.getData<number>("width");
  setStreamChartPositions.call(this, node);
  const leftCurrent = node.getData<StreamPoint[]>("left-pos");
  const rightCurrent = node.getData<StreamPoint[]>("right-pos");
  const { left, right } = extendedBoundaries(
    this,
    node,
    width,
    leftCurrent,
    rightCurrent,
  );
  const controls = bezierControls(left, leftCurrent, rightCurrent, right);
  const colors = node.getData<string[]>("colorArray");
  const context = canvas.getCtx();

  for (let index = 0; index < leftCurrent.length; index += 2) {
    const firstLeft = leftCurrent[index]!;
    let currentRight = rightCurrent[index]!;
    let control = controls[index]!;
    context.fillStyle = context.strokeStyle = colors[(index >> 1) % colors.length]!;
    context.lineWidth = 0;
    context.save();
    context.beginPath();
    context.moveTo(firstLeft[0], firstLeft[1]);
    context.bezierCurveTo(
      control[0],
      control[1],
      control[2],
      control[3],
      currentRight[0],
      currentRight[1],
    );
    const secondLeft = leftCurrent[index + 1]!;
    currentRight = rightCurrent[index + 1]!;
    control = controls[index + 1]!;
    context.lineTo(currentRight[0], currentRight[1]);
    context.bezierCurveTo(
      control[2],
      control[3],
      control[0],
      control[1],
      secondLeft[0],
      secondLeft[1],
    );
    context.closePath();
    context.stroke();
    context.fill();
    context.restore();
  }
}

function pixelHex(data: Uint8ClampedArray, index: number): string {
  return (rgbToHex([data[index]!, data[index + 1]!, data[index + 2]!]) || "").toUpperCase();
}

export function containsStreamChartSmoothNode(
  this: StreamChartRendererContext,
  node: AreaChartNode,
  mousePosition: CartesianCoordinates,
): AreaChartContainedValue | false {
  const position = node.pos.getc(true);
  const width = node.getData<number>("width");
  const height = node.getData<number>("height");
  const aligned = this.getAlignedPos(position, width, height);
  const relativeX = mousePosition.x - aligned.x;
  if (mousePosition.x < aligned.x || mousePosition.x > aligned.x + width) {
    return false;
  }
  const size = this.canvas.getSize();
  const pixelX = mousePosition.x + size.width / 2;
  const pixelY = mousePosition.y + size.height / 2;
  const data = this.canvas
    .getCtx()
    .getImageData(0, 0, size.width, size.height).data;
  const index = (pixelX + pixelY * size.width) * 4;
  const indexAbove = (pixelX + (pixelY - 5) * size.width) * 4;
  const side = Number(relativeX > width / 2);
  const colors = node.getData<string[]>("colorArray");
  for (const sampleIndex of [index, indexAbove]) {
    const color = pixelHex(data, sampleIndex);
    for (let colorIndex = 0; colorIndex < colors.length; colorIndex += 1) {
      if (colors[colorIndex] == color) {
        return {
          name: node.getData<string[]>("stringArray")[colorIndex]!,
          color,
          value: node.getData<AreaChartValuePair[]>("valueArray")[colorIndex]![side]!,
          index: side,
        };
      }
    }
  }
  return false;
}

export function renderStreamChartStackedNode(
  this: StreamChartRendererContext,
  node: AreaChartNode,
  canvas: StreamChartCanvas,
): void {
  setStreamChartPositions.call(this, node);
  const left = node.getData<StreamPoint[]>("left-pos");
  const right = node.getData<StreamPoint[]>("right-pos");
  const colors = node.getData<string[]>("colorArray");
  const context = canvas.getCtx();
  for (let index = 0; index < left.length; index += 2) {
    const firstLeft = left[index]!;
    const firstRight = right[index]!;
    const secondLeft = left[index + 1]!;
    const secondRight = right[index + 1]!;
    context.fillStyle = context.strokeStyle = colors[(index >> 1) % colors.length]!;
    context.save();
    context.beginPath();
    context.moveTo(firstLeft[0] - 0.8, firstLeft[1]);
    context.lineTo(firstRight[0], firstRight[1]);
    context.lineTo(secondRight[0], secondRight[1]);
    context.lineTo(secondLeft[0] - 0.8, secondLeft[1]);
    context.lineTo(firstLeft[0] - 0.8, firstLeft[1]);
    context.closePath();
    context.fill();
    context.restore();
  }
}

export function containsStreamChartStackedNode(
  this: StreamChartRendererContext,
  node: AreaChartNode,
  mousePosition: CartesianCoordinates,
): AreaChartContainedValue | false {
  const position = node.pos.getc(true);
  const width = node.getData<number>("width");
  const height = node.getData<number>("height");
  const aligned = this.getAlignedPos(position, width, height);
  const relativeX = mousePosition.x - aligned.x;
  if (
    mousePosition.x < aligned.x ||
    mousePosition.x > aligned.x + width ||
    mousePosition.y < aligned.y ||
    mousePosition.y > aligned.y + height
  ) {
    return false;
  }
  const left = node.getData<StreamPoint[]>("left-pos");
  const right = node.getData<StreamPoint[]>("right-pos");
  for (let index = 0; index < left.length; index += 2) {
    const firstLeft = left[index]!;
    const firstRight = right[index]!;
    const upper =
      firstLeft[1] +
      ((firstRight[1] - firstLeft[1]) * relativeX) / width;
    const secondLeft = left[index + 1]!;
    const secondRight = right[index + 1]!;
    const lower =
      secondLeft[1] +
      ((secondRight[1] - secondLeft[1]) * relativeX) / width;
    if (mousePosition.y <= upper && mousePosition.y >= lower) {
      const side = Number(relativeX > width / 2);
      // This is an intentional source quirk: the first series is unselectable.
      if (index === 0) return false;
      return {
        name: node.getData<string[]>("stringArray")[index >> 1]!,
        color: node.getData<string[]>("colorArray")[index >> 1]!,
        value: node.getData<AreaChartValuePair[]>("valueArray")[index >> 1]![side]!,
        index: side,
      };
    }
  }
  return false;
}

export const streamChartSmoothNodeType: StreamChartNodeRenderer = {
  render: renderStreamChartSmoothNode,
  contains: containsStreamChartSmoothNode,
};

export const streamChartStackedNodeType: StreamChartNodeRenderer = {
  render: renderStreamChartStackedNode,
  contains: containsStreamChartStackedNode,
};
