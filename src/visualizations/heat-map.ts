import type { ElementRenderContext } from "../graph/rendering/elements.js";
import type { EdgeData, NodeData } from "../types.js";
import {
  GridChartVisualization,
  createGridChartDefaults,
  type GridChartVisualizationCanvas,
  type GridChartVisualizationConfig,
  type GridChartVisualizationDependencies,
  type GridChartVisualizationEdge,
  type GridChartVisualizationNode,
} from "./grid-chart.js";

export function createHeatMapDefaults() {
  return { ...createGridChartDefaults(), showNodeNames: false };
}

export class HeatMapVisualization<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
  TContext extends ElementRenderContext = ElementRenderContext,
  TCanvas extends GridChartVisualizationCanvas<TContext> = GridChartVisualizationCanvas<TContext>,
  TConfig extends GridChartVisualizationConfig<
    GridChartVisualizationNode<TNodeData, TEdgeData>,
    GridChartVisualizationEdge<TNodeData, TEdgeData>
  > = GridChartVisualizationConfig<
    GridChartVisualizationNode<TNodeData, TEdgeData>,
    GridChartVisualizationEdge<TNodeData, TEdgeData>
  >,
> extends GridChartVisualization<TNodeData, TEdgeData, TContext, TCanvas, TConfig> {
  constructor(
    dependencies: GridChartVisualizationDependencies<
      TNodeData,
      TEdgeData,
      TContext,
      TCanvas,
      TConfig
    >,
  ) {
    super(dependencies);
  }

  reposition(): void {
    this.compute("end");
  }
}
