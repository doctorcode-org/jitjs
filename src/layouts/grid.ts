import { indexOf } from "../core/util.js";
import type {
  Graph,
  GraphPosition,
} from "../graph/graph.js";
import type {
  EdgeData,
  NodeData,
  PositionPhase,
} from "../types.js";

export interface GridCanvasSize {
  width: number;
  height: number;
}

export interface GridCanvas {
  getSize(): GridCanvasSize;
}

export interface GridMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface GridLayoutConfig {
  Margin: GridMargin;
  legendX?: readonly unknown[];
  legendY?: readonly unknown[];
}

export interface GridLayoutController {
  onBeforeCompute(): void;
  onAfterCompute(): void;
}

export interface GridPosition extends GraphPosition {
  setc(x: number, y: number): void;
}

/** Independently importable grid layout; it owns no graph or DOM globals. */
export class GridLayout<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
  TPosition extends GridPosition = GridPosition,
> {
  readonly graph: Graph<TNodeData, TEdgeData, TPosition>;
  readonly canvas: GridCanvas;
  readonly config: GridLayoutConfig;
  readonly controller: GridLayoutController;

  constructor(
    graph: Graph<TNodeData, TEdgeData, TPosition>,
    canvas: GridCanvas,
    config: GridLayoutConfig,
    controller: GridLayoutController,
  ) {
    this.graph = graph;
    this.canvas = canvas;
    this.config = config;
    this.controller = controller;
  }

  compute(property: PositionPhase = "current"): void {
    this.controller.onBeforeCompute();
    const size = this.canvas.getSize();
    const margin = this.config.Margin;
    const width = size.width - margin.left - margin.right;
    const height = size.height - margin.top - margin.bottom;
    const legendX = this.getLegendX();
    const legendY = this.getLegendY();
    const elementWidth = width / legendX.length;
    const elementHeight = height / legendY.length;

    this.graph.eachNode((node) => {
      const x =
        indexOf(legendX, node.getData("legendX") || 0) * elementWidth -
        size.width / 2 +
        margin.left;
      const y =
        indexOf(legendY, node.getData("legendY") || 0) * elementHeight -
        size.height / 2 +
        margin.top;
      node.getPos(property)?.setc(x, y);
      node.setData("width", elementWidth);
      node.setData("height", elementHeight);
    });
    this.controller.onAfterCompute();
  }

  protected getLegend(property: "legendX" | "legendY"): unknown[] {
    const configured = this.config[property];
    if (configured?.length) {
      return configured as unknown[];
    }

    const legend: unknown[] = [];
    this.graph.eachNode((node) => {
      const value = node.getData(property);
      if (indexOf(legend, value) < 0) {
        legend.push(value);
      }
    });
    return legend;
  }

  getLegendX(): unknown[] {
    return this.getLegend("legendX");
  }

  getLegendY(): unknown[] {
    return this.getLegend("legendY");
  }
}
