import { hexToRgb, map, reduce, rgbToHex } from "../core/util.js";
import type { CartesianCoordinates } from "../core/geometry.js";
import type {
  AreaChartConfig,
  AreaChartContainedValue,
  AreaChartNode,
  AreaChartValuePair,
} from "./area-chart.js";

/** Canvas surface used by the legacy stacked-area node renderer. */
export interface AreaChartRenderCanvas {
  getCtx(): CanvasRenderingContext2D;
}

/**
 * The one piece of SpaceTree plotting policy the chart node type relies on.
 * Keeping it as the call receiver makes the renderer directly usable by an
 * injected legacy-compatible plotter without installing a global node type.
 */
export interface AreaChartRendererContext {
  getAlignedPos(
    position: CartesianCoordinates,
    width: number,
    height: number,
  ): CartesianCoordinates;
}

export interface AreaChartNodeRenderer {
  render(
    this: AreaChartRendererContext,
    node: AreaChartNode,
    canvas: AreaChartRenderCanvas,
  ): void;
  contains(
    this: AreaChartRendererContext,
    node: AreaChartNode,
    mousePosition: CartesianCoordinates,
  ): AreaChartContainedValue | false;
}

function darkerColor(color: string, factor: number): string {
  const rgb = hexToRgb(color.slice(1))!;
  return rgbToHex(
    map(rgb, (component) => (component * factor) >> 0) as [
      number,
      number,
      number,
    ],
  )!;
}

/** Render the legacy `areachart-stacked` SpaceTree node type. */
export function renderAreaChartStackedNode(
  this: AreaChartRendererContext,
  node: AreaChartNode,
  canvas: AreaChartRenderCanvas,
): void {
  const position = node.pos.getc(true);
  const width = node.getData<number>("width");
  const height = node.getData<number>("height");
  const alignedPosition = this.getAlignedPos(position, width, height);
  const x = alignedPosition.x;
  const y = alignedPosition.y;
  const stringArray = node.getData<string[]>("stringArray");
  const dimensionArray = node.getData<AreaChartValuePair[]>("dimArray");
  const valueArray = node.getData<AreaChartValuePair[]>("valueArray");
  const valueLeft = reduce(
    valueArray,
    (total, value) => total + (value[0] as number),
    0,
  );
  const valueRight = reduce(
    valueArray,
    (total, value) => total + (value[1] as number),
    0,
  );
  const colorArray = node.getData<string[]>("colorArray");
  const colorLength = colorArray.length;
  const config = node.getData<AreaChartConfig>("config");
  const gradient = node.getData<boolean>("gradient");
  const showLabels = config.showLabels;
  const showAggregates = config.showAggregates;
  const label = config.Label;
  const previous = node.getData<string | false>("prev");
  const context = canvas.getCtx();
  const border = node.getData<AreaChartContainedValue | false>("border");

  if (colorArray && dimensionArray && stringArray) {
    let accumulatedLeft = 0;
    let accumulatedRight = 0;
    let accumulatedValue = 0;

    for (let index = 0; index < dimensionArray.length; index += 1) {
      const dimensions = dimensionArray[index]!;
      const color = colorArray[index % colorLength]!;
      context.fillStyle = context.strokeStyle = color;
      context.save();

      if (gradient && (dimensions[0]! > 0 || dimensions[1]! > 0)) {
        const heightLeft = accumulatedLeft + dimensions[0]!;
        const heightRight = accumulatedRight + dimensions[1]!;
        const alpha = Math.atan((heightRight - heightLeft) / width);
        const delta = 55;
        const linearGradient = context.createLinearGradient(
          x + width / 2,
          y - (heightLeft + heightRight) / 2,
          x + width / 2 + delta * Math.sin(alpha),
          y - (heightLeft + heightRight) / 2 + delta * Math.cos(alpha),
        );
        linearGradient.addColorStop(0, color);
        linearGradient.addColorStop(1, darkerColor(color, 0.85));
        context.fillStyle = linearGradient;
      }

      context.beginPath();
      context.moveTo(x, y - accumulatedLeft);
      context.lineTo(x + width, y - accumulatedRight);
      context.lineTo(
        x + width,
        y - accumulatedRight - dimensions[1]!,
      );
      context.lineTo(x, y - accumulatedLeft - dimensions[0]!);
      context.lineTo(x, y - accumulatedLeft);
      context.fill();
      context.restore();

      if (border) {
        // Intentional loose equality: the 2.0.1 renderer allowed numeric and
        // string stack names to match here.
        const strong = border.name == stringArray[index];
        const factor = strong ? 0.7 : 0.8;
        context.strokeStyle = darkerColor(color, factor);
        context.lineWidth = strong ? 4 : 1;
        context.save();
        context.beginPath();
        if (border.index === 0) {
          context.moveTo(x, y - accumulatedLeft);
          context.lineTo(x, y - accumulatedLeft - dimensions[0]!);
        } else {
          context.moveTo(x + width, y - accumulatedRight);
          context.lineTo(
            x + width,
            y - accumulatedRight - dimensions[1]!,
          );
        }
        context.stroke();
        context.restore();
      }

      accumulatedLeft += dimensions[0] || 0;
      accumulatedRight += dimensions[1] || 0;
      if (dimensions[0]! > 0) {
        accumulatedValue += valueArray[index]![0] || 0;
      }
    }

    if (previous && label.type == "Native") {
      context.save();
      context.beginPath();
      context.fillStyle = context.strokeStyle = label.color;
      context.font = `${label.style} ${label.size}px ${label.family}`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      const aggregateValue = showAggregates(
        node.name,
        valueLeft,
        valueRight,
        node,
        accumulatedValue,
      );
      if (aggregateValue !== false) {
        context.fillText(
          (aggregateValue !== true
            ? aggregateValue
            : accumulatedValue) as string,
          x,
          y - accumulatedLeft - config.labelOffset - label.size / 2,
          width,
        );
      }
      if (showLabels(node.name, valueLeft, valueRight, node)) {
        context.fillText(
          node.name,
          x,
          y + label.size / 2 + config.labelOffset,
        );
      }
      context.restore();
    }
  }
}

/** Hit-test the legacy `areachart-stacked` SpaceTree node type. */
export function containsAreaChartStackedNode(
  this: AreaChartRendererContext,
  node: AreaChartNode,
  mousePosition: CartesianCoordinates,
): AreaChartContainedValue | false {
  const position = node.pos.getc(true);
  const width = node.getData<number>("width");
  const height = node.getData<number>("height");
  const alignedPosition = this.getAlignedPos(position, width, height);
  const x = alignedPosition.x;
  const y = alignedPosition.y;
  const dimensionArray = node.getData<AreaChartValuePair[]>("dimArray");
  const relativeX = mousePosition.x - x;

  if (
    mousePosition.x < x ||
    mousePosition.x > x + width ||
    mousePosition.y > y ||
    mousePosition.y < y - height
  ) {
    return false;
  }

  let accumulatedLeft = y;
  let accumulatedRight = y;
  for (let index = 0; index < dimensionArray.length; index += 1) {
    const dimensions = dimensionArray[index]!;
    accumulatedLeft -= dimensions[0]!;
    accumulatedRight -= dimensions[1]!;
    const intersection =
      accumulatedLeft +
      ((accumulatedRight - accumulatedLeft) * relativeX) / width;
    if (mousePosition.y >= intersection) {
      const side = Number(relativeX > width / 2);
      return {
        name: node.getData<string[]>("stringArray")[index]!,
        color: node.getData<string[]>("colorArray")[index]!,
        value: node.getData<AreaChartValuePair[]>("valueArray")[index]![side]!,
        index: side,
      };
    }
  }

  return false;
}

/** Direct replacement for the old global `ST.Plot.NodeTypes` entry. */
export const areaChartStackedNodeType: AreaChartNodeRenderer = {
  render: renderAreaChartStackedNode,
  contains: containsAreaChartStackedNode,
};

/** Descriptive alias for consumers that call composed values renderers. */
export const areaChartStackedNodeRenderer = areaChartStackedNodeType;
