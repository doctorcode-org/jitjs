import type { EdgeData, NodeData, PositionPhase } from "../types.js";
import type { Graph, GraphNode, GraphPosition } from "./graph.js";

/** The subset of visualization configuration used by graph geometry. */
export interface GraphGeometryConfig {
  levelsToShow: number;
  constrained?: boolean;
}

/** Label behavior needed when nodes outside the visible levels are hidden. */
export interface GraphGeometryLabels<TNode> {
  hideLabel(node: TNode, force: boolean): void;
}

/**
 * Visualization-specific fit calculation.
 *
 * The legacy mixin expected subclasses to install `treeFitsInCanvas`. Making
 * it an explicit dependency keeps this module independent from any layout or
 * canvas implementation.
 */
export type TreeFitsInCanvas<TNode, TCanvas> = (
  node: TNode,
  canvas: TCanvas,
  level: number,
) => boolean;

export interface LevelVisibilityOptions<TNode> {
  execShow?: boolean;
  execHide?: boolean;
  onHide?: (node: TNode) => void;
  onShow?: (node: TNode) => void;
}

export type GraphTranslation<TPosition> = TPosition extends {
  $add(position: infer TTranslation): unknown;
}
  ? TTranslation
  : never;

type GeometryNode<
  TNodeData extends NodeData,
  TEdgeData extends EdgeData,
  TPosition extends GraphPosition,
> = GraphNode<TNodeData, TEdgeData, TPosition>;

export interface GraphGeometryDependencies<
  TNodeData extends NodeData,
  TEdgeData extends EdgeData,
  TPosition extends GraphPosition,
  TCanvas,
> {
  graph: Pick<Graph<TNodeData, TEdgeData, TPosition>, "eachNode">;
  config: GraphGeometryConfig;
  labels: GraphGeometryLabels<GeometryNode<TNodeData, TEdgeData, TPosition>>;
  treeFitsInCanvas: TreeFitsInCanvas<
    GeometryNode<TNodeData, TEdgeData, TPosition>,
    TCanvas
  >;
}

export interface GraphGeometry<
  TNodeData extends NodeData,
  TEdgeData extends EdgeData,
  TPosition extends GraphPosition,
  TCanvas,
> {
  translate(
    position: GraphTranslation<TPosition>,
    phase: PositionPhase | readonly PositionPhase[],
  ): void;
  getRightLevelToShow(
    node: GeometryNode<TNodeData, TEdgeData, TPosition>,
    canvas: TCanvas,
  ): number;
  setRightLevelToShow(
    node: GeometryNode<TNodeData, TEdgeData, TPosition>,
    canvas: TCanvas,
    options?: LevelVisibilityOptions<
      GeometryNode<TNodeData, TEdgeData, TPosition>
    >,
  ): void;
}

/** Translate one or more position phases for every node in a graph. */
export function translate<
  TNodeData extends NodeData,
  TEdgeData extends EdgeData,
  TPosition extends GraphPosition,
>(
  graph: Pick<Graph<TNodeData, TEdgeData, TPosition>, "eachNode">,
  position: GraphTranslation<TPosition>,
  phase: PositionPhase | readonly PositionPhase[],
): void {
  const phases = (Array.isArray(phase) ? phase : [phase]) as readonly PositionPhase[];

  graph.eachNode((node) => {
    for (const currentPhase of phases) {
      const nodePosition = node.getPos(currentPhase) as TPosition & {
        $add(value: GraphTranslation<TPosition>): unknown;
      };
      nodePosition.$add(position);
    }
  });
}

/** Find the deepest visible level that satisfies the injected fit predicate. */
export function getRightLevelToShow<TNode, TCanvas>(
  config: GraphGeometryConfig,
  node: TNode,
  canvas: TCanvas,
  treeFitsInCanvas: TreeFitsInCanvas<TNode, TCanvas>,
): number {
  let level = config.levelsToShow;
  if (!config.constrained) {
    return level;
  }

  while (!treeFitsInCanvas(node, canvas, level) && level > 1) {
    level -= 1;
  }
  return level;
}

/** Apply the visible-level decision to a rooted graph subtree. */
export function setRightLevelToShow<
  TNodeData extends NodeData,
  TEdgeData extends EdgeData,
  TPosition extends GraphPosition,
  TCanvas,
>(
  dependencies: Omit<
    GraphGeometryDependencies<TNodeData, TEdgeData, TPosition, TCanvas>,
    "graph"
  >,
  node: GeometryNode<TNodeData, TEdgeData, TPosition>,
  canvas: TCanvas,
  callbacks?: LevelVisibilityOptions<
    GeometryNode<TNodeData, TEdgeData, TPosition>
  >,
): void {
  const level = getRightLevelToShow(
    dependencies.config,
    node,
    canvas,
    dependencies.treeFitsInCanvas,
  );
  const options = {
    execShow: true,
    execHide: true,
    onHide: (_hiddenNode: typeof node): void => {},
    onShow: (_shownNode: typeof node): void => {},
    ...(callbacks ?? {}),
  } as Required<LevelVisibilityOptions<typeof node>>;

  node.eachLevel(0, dependencies.config.levelsToShow, (candidate) => {
    const relativeDepth =
      (candidate._depth as number) - (node._depth as number);

    if (relativeDepth > level) {
      options.onHide(candidate);
      if (options.execHide) {
        candidate.drawn = false;
        candidate.exist = false;
        dependencies.labels.hideLabel(candidate, false);
      }
      return;
    }

    options.onShow(candidate);
    if (options.execShow) {
      candidate.exist = true;
    }
  });

  node.drawn = true;
}

/**
 * Compose graph geometry once, then use an API shaped like the legacy helper.
 * No method is installed on `Graph`, and creating an instance has no globals.
 */
export function createGraphGeometry<
  TNodeData extends NodeData,
  TEdgeData extends EdgeData,
  TPosition extends GraphPosition,
  TCanvas,
>(
  dependencies: GraphGeometryDependencies<
    TNodeData,
    TEdgeData,
    TPosition,
    TCanvas
  >,
): GraphGeometry<TNodeData, TEdgeData, TPosition, TCanvas> {
  return {
    translate(position, phase): void {
      translate(dependencies.graph, position, phase);
    },

    getRightLevelToShow(node, canvas): number {
      return getRightLevelToShow(
        dependencies.config,
        node,
        canvas,
        dependencies.treeFitsInCanvas,
      );
    },

    setRightLevelToShow(node, canvas, options): void {
      setRightLevelToShow(dependencies, node, canvas, options);
    },
  };
}
