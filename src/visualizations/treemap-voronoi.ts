import type { ElementRenderContext } from "../graph/rendering/elements.js";
import { VoronoiTreemapLayout } from "../layouts/treemap/voronoi.js";
import type { EdgeData, NodeData } from "../types.js";
import {
  TreemapVisualization,
  type TreemapVisualizationBaseDependencies,
  type TreemapVisualizationCanvas,
  type TreemapVisualizationConfig,
  type TreemapVisualizationEdge,
  type TreemapVisualizationNode,
} from "./treemap.js";

export function createVoronoiTreemapDefaults() {
  return {
    centroidType: "weightedCentroid" as const,
    Node: {
      type: "polygon" as const,
      props: "node-property:width:height:vertices",
    },
    Label: {
      textBaseline: "middle" as const,
      type: "Native" as const,
    },
  };
}

export class VoronoiTreemapVisualization<
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
      createLayout: (options) => new VoronoiTreemapLayout(options),
    });
  }

  protected override geometryModes(): string[] {
    return ["linear", "node-property:width:height:vertices"];
  }
}
