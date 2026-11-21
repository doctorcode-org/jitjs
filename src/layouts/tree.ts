import type { Complex } from "../core/geometry.js";
import type {
  Graph,
  GraphNode,
  GraphPosition,
} from "../graph/graph.js";
import type {
  EdgeData,
  NodeData,
  PositionPhase,
} from "../types.js";

export type TreeOrientation = "top" | "right" | "bottom" | "left";
export type TreeAlignment = "left" | "center" | "right";
export type TreeAxis = "x" | "y";
export type TreeDimension = "width" | "height";

export interface TreeNodeDimensions {
  width: number;
  height: number;
}

export interface TreeNodeConfig extends TreeNodeDimensions {
  overridable?: boolean;
}

export interface TreeLayoutConfig {
  Node: TreeNodeConfig;
  orientation: TreeOrientation;
  subtreeOffset: number;
  siblingOffset: number;
  indent: number;
  multitree: boolean;
  align: TreeAlignment;
  levelDistance: number;
}

/** Cartesian position shape mutated by the tree layout. */
export interface TreePosition extends GraphPosition {
  x: number;
  y: number;
}

type TreeGraphNode<
  TNodeData extends NodeData,
  TEdgeData extends EdgeData,
  TPosition extends TreePosition,
> = GraphNode<TNodeData, TEdgeData, TPosition>;

/**
 * Supplies effective dimensions without coupling the layout to labels or DOM
 * measurement. It may read graph data, a cache, or a renderer-owned metric.
 */
export type NodeDimensionResolver<
  TNodeData extends NodeData,
  TEdgeData extends EdgeData,
  TPosition extends TreePosition,
> = (
  node: TreeGraphNode<TNodeData, TEdgeData, TPosition>,
  phase: PositionPhase,
) => TreeNodeDimensions;

export type TreeExtentEntry = readonly [lower: number, upper: number];
export type TreeExtent = readonly TreeExtentEntry[];

export interface TreeDesignResult<
  TNodeData extends NodeData,
  TEdgeData extends EdgeData,
  TPosition extends TreePosition,
> {
  tree: TreeGraphNode<TNodeData, TEdgeData, TPosition>;
  extent: TreeExtent;
}

export interface TreeLayoutDependencies<
  TNodeData extends NodeData,
  TEdgeData extends EdgeData,
  TPosition extends TreePosition,
> {
  graph: Graph<TNodeData, TEdgeData, TPosition>;
  root: string;
  config: TreeLayoutConfig;
  getNodeDimensions: NodeDimensionResolver<TNodeData, TEdgeData, TPosition>;
}

function orientationAxes(orientation: TreeOrientation): {
  crossAxis: TreeAxis;
  depthAxis: TreeAxis;
  crossDimension: TreeDimension;
  depthDimension: TreeDimension;
} {
  const horizontal = orientation === "left" || orientation === "right";
  return horizontal
    ? {
        crossAxis: "y",
        depthAxis: "x",
        crossDimension: "height",
        depthDimension: "width",
      }
    : {
        crossAxis: "x",
        depthAxis: "y",
        crossDimension: "width",
        depthDimension: "height",
      };
}

function belongsToOrientation<TNodeData extends NodeData>(
  node: Pick<GraphNode<TNodeData>, "data">,
  orientation: TreeOrientation,
  multitree: boolean,
): boolean {
  return (
    !multitree ||
    ("$orn" in node.data && node.data.$orn == orientation)
  );
}

function getPosition<
  TNodeData extends NodeData,
  TEdgeData extends EdgeData,
  TPosition extends TreePosition,
>(
  node: TreeGraphNode<TNodeData, TEdgeData, TPosition>,
  phase: PositionPhase,
): TPosition {
  return node.getPos(phase) as TPosition;
}

/** Calculate the maximum effective node dimensions at one tree depth. */
export function getBoundaries<
  TNodeData extends NodeData,
  TEdgeData extends EdgeData,
  TPosition extends TreePosition,
>(
  graph: Graph<TNodeData, TEdgeData, TPosition>,
  config: TreeLayoutConfig,
  level: number,
  orientation: TreeOrientation,
  phase: PositionPhase,
  getNodeDimensions: NodeDimensionResolver<TNodeData, TEdgeData, TPosition>,
): TreeNodeDimensions {
  if (!config.Node.overridable) {
    return {
      width: config.Node.width,
      height: config.Node.height,
    };
  }

  let width = -1;
  let height = -1;
  graph.eachNode((node) => {
    if (
      node._depth == level &&
      belongsToOrientation(node, orientation, config.multitree)
    ) {
      const dimensions = getNodeDimensions(node, phase);
      width = width < dimensions.width ? dimensions.width : width;
      height = height < dimensions.height ? dimensions.height : height;
    }
  });

  return {
    width: width < 0 ? config.Node.width : width,
    height: height < 0 ? config.Node.height : height,
  };
}

/** Return an extent translated along the layout's cross axis. */
export function moveExtent(extent: TreeExtent, value: number): TreeExtent {
  return extent.map(
    ([lower, upper]) => [lower + value, upper + value] as const,
  );
}

/** Merge the outside boundaries of two already-positioned extents. */
export function mergeExtents(
  left: TreeExtent,
  right: TreeExtent,
): TreeExtent {
  if (left.length === 0) {
    return right.slice();
  }
  if (right.length === 0) {
    return left.slice();
  }

  const length = Math.max(left.length, right.length);
  const merged: TreeExtentEntry[] = [];
  for (let index = 0; index < length; index += 1) {
    const leftEntry = left[index];
    const rightEntry = right[index];
    if (leftEntry && rightEntry) {
      merged.push([leftEntry[0], rightEntry[1]]);
    } else if (leftEntry) {
      merged.push([leftEntry[0], leftEntry[1]]);
    } else if (rightEntry) {
      merged.push([rightEntry[0], rightEntry[1]]);
    }
  }
  return merged;
}

/** Merge a sibling list into a single outside extent. */
export function mergeExtentList(
  extents: readonly TreeExtent[],
  fallback: TreeExtent = [],
): TreeExtent {
  let merged = fallback;
  for (let index = extents.length - 1; index >= 0; index -= 1) {
    merged = mergeExtents(extents[index] as TreeExtent, merged);
  }
  return merged;
}

/** Find the minimum shift needed to separate two subtree extents. */
export function fitExtents(
  left: TreeExtent,
  right: TreeExtent,
  subtreeOffset: number,
  siblingOffset: number,
): number {
  let result = 0;
  const overlap = Math.min(left.length, right.length);
  for (let index = overlap - 1; index >= 0; index -= 1) {
    const leftEntry = left[index] as TreeExtentEntry;
    const rightEntry = right[index] as TreeExtentEntry;
    result = Math.max(
      result + subtreeOffset,
      leftEntry[1] - rightEntry[0] + siblingOffset,
    );
  }
  return result;
}

function fitExtentListLeft(
  extents: readonly TreeExtent[],
  subtreeOffset: number,
  siblingOffset: number,
): number[] {
  let accumulated: TreeExtent = [];
  const positions: number[] = [];
  for (const extent of extents) {
    const position = fitExtents(
      accumulated,
      extent,
      subtreeOffset,
      siblingOffset,
    );
    positions.push(position);
    accumulated = mergeExtents(accumulated, moveExtent(extent, position));
  }
  return positions;
}

function fitExtentListRight(
  extents: readonly TreeExtent[],
  subtreeOffset: number,
  siblingOffset: number,
): number[] {
  let accumulated: TreeExtent = [];
  const reversedPositions: number[] = [];
  for (let index = extents.length - 1; index >= 0; index -= 1) {
    const extent = extents[index] as TreeExtent;
    const position = -fitExtents(
      extent,
      accumulated,
      subtreeOffset,
      siblingOffset,
    );
    reversedPositions.push(position);
    accumulated = mergeExtents(moveExtent(extent, position), accumulated);
  }
  return reversedPositions.reverse();
}

/** Position sibling extents according to left, centered, or right alignment. */
export function fitExtentList(
  extents: readonly TreeExtent[],
  subtreeOffset: number,
  siblingOffset: number,
  align: TreeAlignment,
): number[] {
  let leftPositions = fitExtentListLeft(
    extents,
    subtreeOffset,
    siblingOffset,
  );
  let rightPositions = fitExtentListRight(
    extents,
    subtreeOffset,
    siblingOffset,
  );

  if (align === "left") {
    rightPositions = leftPositions;
  } else if (align === "right") {
    leftPositions = rightPositions;
  }

  return leftPositions.map(
    (position, index) =>
      (position + (rightPositions[index] as number)) / 2,
  );
}

function moveTree<
  TNodeData extends NodeData,
  TEdgeData extends EdgeData,
  TPosition extends TreePosition,
>(
  node: TreeGraphNode<TNodeData, TEdgeData, TPosition>,
  phase: PositionPhase,
  value: number,
  orientation: TreeOrientation,
): void {
  const { crossAxis } = orientationAxes(orientation);
  getPosition(node, phase)[crossAxis] += value;
}

/**
 * Design one oriented subtree with relative coordinates and return its extent.
 */
export function design<
  TNodeData extends NodeData,
  TEdgeData extends EdgeData,
  TPosition extends TreePosition,
>(
  graph: Graph<TNodeData, TEdgeData, TPosition>,
  node: TreeGraphNode<TNodeData, TEdgeData, TPosition>,
  phase: PositionPhase,
  config: TreeLayoutConfig,
  orientation: TreeOrientation,
  getNodeDimensions: NodeDimensionResolver<TNodeData, TEdgeData, TPosition>,
): TreeDesignResult<TNodeData, TEdgeData, TPosition> {
  const {
    crossAxis,
    depthAxis,
    crossDimension,
    depthDimension,
  } = orientationAxes(orientation);

  const designNode = (
    current: TreeGraphNode<TNodeData, TEdgeData, TPosition>,
    maximumDepthSize: number | false,
    accumulatedDepth: number,
  ): TreeDesignResult<TNodeData, TEdgeData, TPosition> => {
    const dimensions = getNodeDimensions(current, phase);
    const crossSize = dimensions[crossDimension];
    const depthSize = maximumDepthSize || dimensions[depthDimension];
    const childDepth = depthSize + config.levelDistance;
    const childDesigns: Array<
      TreeDesignResult<TNodeData, TEdgeData, TPosition>
    > = [];
    let childMaximumDimensions: TreeNodeDimensions | false = false;

    current.eachSubnode((child) => {
      if (
        child.exist &&
        belongsToOrientation(child, orientation, config.multitree)
      ) {
        if (!childMaximumDimensions) {
          childMaximumDimensions = getBoundaries(
            graph,
            config,
            child._depth as number,
            orientation,
            phase,
            getNodeDimensions,
          );
        }

        childDesigns.push(
          designNode(
            child,
            childMaximumDimensions[depthDimension],
            accumulatedDepth + childDepth,
          ),
        );
      }
    });

    const childExtents = childDesigns.map((result) => result.extent);
    const positions = fitExtentList(
      childExtents,
      config.subtreeOffset,
      config.siblingOffset,
      config.align,
    );
    const positionedExtents: TreeExtent[] = [];

    for (let index = 0; index < childDesigns.length; index += 1) {
      const childDesign = childDesigns[index] as TreeDesignResult<
        TNodeData,
        TEdgeData,
        TPosition
      >;
      const position = positions[index] as number;
      moveTree(childDesign.tree, phase, position, orientation);
      positionedExtents.push(moveExtent(childDesign.extent, position));
    }

    const position = getPosition(current, phase);
    position[crossAxis] = 0;
    position[depthAxis] =
      orientation === "top" || orientation === "left"
        ? accumulatedDepth
        : -accumulatedDepth;

    return {
      tree: current,
      extent: [
        [-crossSize / 2, crossSize / 2],
        ...mergeExtentList(positionedExtents),
      ],
    };
  };

  return designNode(node, false, 0);
}

/** Tree layout composed from a graph, configuration, and dimension resolver. */
export class TreeLayout<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
  TPosition extends TreePosition = Complex,
> {
  readonly graph: Graph<TNodeData, TEdgeData, TPosition>;
  root: string;
  readonly config: TreeLayoutConfig;
  readonly getNodeDimensions: NodeDimensionResolver<
    TNodeData,
    TEdgeData,
    TPosition
  >;

  constructor(
    dependencies: TreeLayoutDependencies<TNodeData, TEdgeData, TPosition>,
  ) {
    this.graph = dependencies.graph;
    this.root = dependencies.root;
    this.config = dependencies.config;
    this.getNodeDimensions = dependencies.getNodeDimensions;
  }

  compute(property?: PositionPhase, recomputeLevels?: boolean): void {
    const phase = property || "start";
    const root = this.graph.getNode(this.root) as TreeGraphNode<
      TNodeData,
      TEdgeData,
      TPosition
    >;

    root.drawn = true;
    root.exist = true;
    root.selected = true;

    if (recomputeLevels || !("_depth" in root)) {
      this.graph.computeLevels(this.root, 0, "ignore");
    }

    this.computePositions(root, phase);
  }

  computePositions(
    root: TreeGraphNode<TNodeData, TEdgeData, TPosition>,
    phase: PositionPhase,
  ): void {
    const orientations: readonly TreeOrientation[] = this.config.multitree
      ? ["top", "right", "bottom", "left"]
      : [this.config.orientation];
    const indent =
      this.config.align !== "center" ? this.config.indent : false;

    for (const orientation of orientations) {
      design(
        this.graph,
        root,
        phase,
        this.config,
        orientation,
        this.getNodeDimensions,
      );

      const { crossAxis } = orientationAxes(orientation);
      const absolutize = (
        node: TreeGraphNode<TNodeData, TEdgeData, TPosition>,
      ): void => {
        node.eachSubnode((child) => {
          if (
            child.exist &&
            belongsToOrientation(
              child,
              orientation,
              this.config.multitree,
            )
          ) {
            const childPosition = getPosition(child, phase);
            childPosition[crossAxis] += getPosition(node, phase)[crossAxis];
            if (indent) {
              childPosition[crossAxis] +=
                this.config.align === "left" ? indent : -indent;
            }
            absolutize(child);
          }
        });
      };

      absolutize(root);
    }
  }
}
