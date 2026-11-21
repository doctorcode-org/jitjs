import type {
  Graph,
} from "../../graph/graph.js";
import type {
  EdgeData,
  NodeData,
  PositionPhase,
} from "../../types.js";
import type {
  ResolvedTreemapLayoutConfig,
  TreemapAreaNode,
  TreemapCoordinates,
  TreemapLayoutController,
  TreemapLayoutDependencies,
  TreemapNode,
  TreemapOrientation,
  TreemapPosition,
} from "./types.js";

export type TreemapAspectRatioComparator<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
  TPosition extends TreemapPosition = TreemapPosition,
> = (
  children: readonly TreemapAreaNode<TNodeData, TEdgeData, TPosition>[],
  fixedDimension: number,
) => number;

/** Legacy squarified-row score: the largest aspect ratio in a row. */
export function worstAspectRatio<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
  TPosition extends TreemapPosition = TreemapPosition,
>(
  children: readonly TreemapAreaNode<TNodeData, TEdgeData, TPosition>[],
  fixedDimension: number,
): number {
  if (!children || children.length === 0) {
    return Number.MAX_VALUE;
  }

  let areaSum = 0;
  let maximumArea = 0;
  let minimumArea = Number.MAX_VALUE;
  for (const child of children) {
    const area = child._area as number;
    areaSum += area;
    minimumArea = minimumArea < area ? minimumArea : area;
    maximumArea = maximumArea > area ? maximumArea : area;
  }

  const squaredDimension = fixedDimension * fixedDimension;
  const squaredAreaSum = areaSum * areaSum;
  return Math.max(
    (squaredDimension * maximumArea) / squaredAreaSum,
    squaredAreaSum / (squaredDimension * minimumArea),
  );
}

/** Legacy strip-row score: the mean aspect ratio in a row. */
export function averageAspectRatio<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
  TPosition extends TreemapPosition = TreemapPosition,
>(
  children: readonly TreemapAreaNode<TNodeData, TEdgeData, TPosition>[],
  fixedDimension: number,
): number {
  if (!children || children.length === 0) {
    return Number.MAX_VALUE;
  }

  let aspectRatioSum = 0;
  for (const child of children) {
    const area = child._area as number;
    const otherDimension = area / fixedDimension;
    aspectRatioSum += fixedDimension > otherDimension
      ? fixedDimension / otherDimension
      : otherDimension / fixedDimension;
  }
  return aspectRatioSum / children.length;
}

/**
 * Shared state and recursive row partitioning for area-based treemaps.
 *
 * Graph and canvas are injected and imported as types only. Concrete layout
 * modules depend on this file, but never on one another or on a registry.
 */
export abstract class AreaTreemapLayout<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
  TPosition extends TreemapPosition = TreemapPosition,
> {
  readonly graph: Graph<TNodeData, TEdgeData, TPosition>;
  root: string;
  readonly getSize: () => { width: number; height: number };
  readonly config: Readonly<ResolvedTreemapLayoutConfig>;
  readonly controller: TreemapLayoutController<
    TNodeData,
    TEdgeData,
    TPosition
  >;
  clickedNode: TreemapNode<TNodeData, TEdgeData, TPosition> | null;
  orientation: TreemapOrientation;

  constructor(
    dependencies: TreemapLayoutDependencies<
      TNodeData,
      TEdgeData,
      TPosition
    >,
  ) {
    this.graph = dependencies.graph;
    this.root = dependencies.root;
    this.getSize = dependencies.getSize;
    this.controller = dependencies.controller || {
      onBeforeCompute: () => {},
      onAfterCompute: () => {},
    };
    this.clickedNode = dependencies.clickedNode ?? null;

    const config = dependencies.config || {};
    this.config = {
      ...config,
      orientation: config.orientation ?? "h",
      titleHeight: config.titleHeight ?? 13,
      offset: config.offset ?? 2,
    };
    this.orientation = this.config.orientation;
  }

  horizontal(): boolean {
    return this.orientation === "h";
  }

  vertical(): boolean {
    return this.orientation === "v";
  }

  changeOrientation(): void {
    this.orientation = this.vertical() ? "h" : "v";
  }

  compute(property: PositionPhase = "current"): void {
    const root = this.requireNode(this.clickedNode?.id || this.root);
    this.controller.onBeforeCompute(root);

    const { width, height } = this.getSize();
    const offsetWidth = width - this.config.offset;
    const offsetHeight = height - this.config.offset;

    // Keep the legacy behavior: levels are based on the canonical root even
    // when geometry is being computed for a selected subtree.
    this.graph.computeLevels(this.root, 0, "ignore");
    (root.getPos(property) as TPosition).setc(-width / 2, -height / 2);
    root.setData("width", width, property);
    root.setData("height", height, property);

    this.computePositions(
      root,
      {
        top: -height / 2 + this.config.titleHeight,
        left: -width / 2,
        width: offsetWidth,
        height: offsetHeight - this.config.titleHeight,
      },
      property,
    );

    this.controller.onAfterCompute(root);
  }

  abstract computePositions(
    node: TreemapAreaNode<TNodeData, TEdgeData, TPosition>,
    coordinates: TreemapCoordinates,
    property: PositionPhase,
  ): void;

  /** Recursively groups siblings into rows using the supplied score. */
  computeDimension(
    tail: Array<TreemapAreaNode<TNodeData, TEdgeData, TPosition>>,
    initialElements: Array<
      TreemapAreaNode<TNodeData, TEdgeData, TPosition>
    >,
    fixedDimension: number,
    coordinates: TreemapCoordinates,
    compare: TreemapAspectRatioComparator<
      TNodeData,
      TEdgeData,
      TPosition
    >,
    property: PositionPhase,
  ): void {
    if (tail.length + initialElements.length === 1) {
      const finalElements = tail.length === 1 ? tail : initialElements;
      this.layoutLast(finalElements, fixedDimension, coordinates, property);
      return;
    }

    if (tail.length >= 2 && initialElements.length === 0) {
      initialElements = [tail.shift() as TreemapAreaNode<
        TNodeData,
        TEdgeData,
        TPosition
      >];
    }

    if (tail.length === 0) {
      if (initialElements.length > 0) {
        this.layoutRow(
          initialElements,
          fixedDimension,
          coordinates,
          property,
        );
      }
      return;
    }

    const candidate = tail[0] as TreemapAreaNode<
      TNodeData,
      TEdgeData,
      TPosition
    >;
    if (
      compare(initialElements, fixedDimension) >=
      compare([candidate].concat(initialElements), fixedDimension)
    ) {
      this.computeDimension(
        tail.slice(1),
        initialElements.concat([candidate]),
        fixedDimension,
        coordinates,
        compare,
        property,
      );
      return;
    }

    const newCoordinates = this.layoutRow(
      initialElements,
      fixedDimension,
      coordinates,
      property,
    );
    this.computeDimension(
      tail,
      [],
      newCoordinates.dim as number,
      newCoordinates,
      compare,
      property,
    );
  }

  abstract layoutRow(
    children: Array<TreemapAreaNode<TNodeData, TEdgeData, TPosition>>,
    fixedDimension: number,
    coordinates: TreemapCoordinates,
    property: PositionPhase,
  ): TreemapCoordinates;

  layoutLast(
    children: Array<TreemapAreaNode<TNodeData, TEdgeData, TPosition>>,
    _fixedDimension: number,
    coordinates: TreemapCoordinates,
    property: PositionPhase,
  ): void {
    const child = children[0] as TreemapAreaNode<
      TNodeData,
      TEdgeData,
      TPosition
    >;
    (child.getPos(property) as TPosition).setc(
      coordinates.left,
      coordinates.top,
    );
    child.setData("width", coordinates.width, property);
    child.setData("height", coordinates.height, property);
  }

  private requireNode(
    id: string,
  ): TreemapNode<TNodeData, TEdgeData, TPosition> {
    const node = this.graph.getNode(id);
    if (!node) {
      throw new Error(`Unknown graph node: ${id}`);
    }
    return node;
  }
}
