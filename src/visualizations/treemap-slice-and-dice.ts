import type {
  ElementRenderContext,
} from "../graph/rendering/elements.js";
import { SliceAndDiceTreemapLayout } from "../layouts/treemap/slice-and-dice.js";
import type { EdgeData, NodeData } from "../types.js";
import {
  TreemapVisualization,
  type TreemapVisualizationBaseDependencies,
  type TreemapVisualizationCanvas,
  type TreemapVisualizationConfig,
  type TreemapVisualizationEdge,
  type TreemapVisualizationNode,
} from "./treemap.js";

export class SliceAndDiceTreemapVisualization<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
  TContext extends ElementRenderContext = ElementRenderContext,
  TCanvas extends TreemapVisualizationCanvas<TContext> =
    TreemapVisualizationCanvas<TContext>,
  TConfig extends TreemapVisualizationConfig<
    TreemapVisualizationNode<TNodeData, TEdgeData>,
    TreemapVisualizationEdge<TNodeData, TEdgeData>,
    TNodeData
  > = TreemapVisualizationConfig<
    TreemapVisualizationNode<TNodeData, TEdgeData>,
    TreemapVisualizationEdge<TNodeData, TEdgeData>,
    TNodeData
  >,
> extends TreemapVisualization<
  TNodeData,
  TEdgeData,
  TContext,
  TCanvas,
  TConfig
> {
  constructor(
    dependencies: TreemapVisualizationBaseDependencies<
      TNodeData,
      TEdgeData,
      TContext,
      TCanvas,
      TConfig
    >,
  ) {
    super({
      ...dependencies,
      createLayout: (options) => new SliceAndDiceTreemapLayout(options),
    });
  }
}
