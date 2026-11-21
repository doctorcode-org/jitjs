import type { ElementRenderContext } from "../graph/rendering/elements.js";
import { StripTreemapLayout } from "../layouts/treemap/strip.js";
import type { EdgeData, NodeData } from "../types.js";
import {
  TreemapVisualization,
  type TreemapVisualizationBaseDependencies,
  type TreemapVisualizationCanvas,
  type TreemapVisualizationConfig,
  type TreemapVisualizationEdge,
  type TreemapVisualizationNode,
} from "./treemap.js";

export class StripTreemapVisualization<
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
      createLayout: (options) => new StripTreemapLayout(options),
    });
  }
}
