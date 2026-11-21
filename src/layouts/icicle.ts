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

export type IcicleOrientation = "h" | "v";

/** The only position operation required by the icicle layout. */
export interface IciclePosition extends GraphPosition {
  setc(x: number, y: number): void;
}

export interface IcicleCanvasSize {
  width: number;
  height: number;
}

export interface IcicleLayoutConfig extends Record<string, unknown> {
  orientation?: IcicleOrientation;
  offset?: number;
  levelsToShow?: number;
  constrained?: boolean;
}

export interface ResolvedIcicleLayoutConfig extends IcicleLayoutConfig {
  orientation: IcicleOrientation;
  offset: number;
  levelsToShow: number;
  constrained: boolean;
}

export type IcicleNode<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
  TPosition extends IciclePosition = IciclePosition,
> = GraphNode<TNodeData, TEdgeData, TPosition>;

export interface IcicleLayoutController<
  TNodeData extends NodeData,
  TEdgeData extends EdgeData,
  TPosition extends IciclePosition,
> {
  onBeforeCompute(
    root: IcicleNode<TNodeData, TEdgeData, TPosition>,
  ): void;
}

export interface IcicleLayoutDependencies<
  TNodeData extends NodeData,
  TEdgeData extends EdgeData,
  TPosition extends IciclePosition,
> {
  graph: Graph<TNodeData, TEdgeData, TPosition>;
  root: string;
  /** Supplies canvas dimensions without importing the canvas package. */
  getSize: () => IcicleCanvasSize;
  config?: IcicleLayoutConfig;
  controller?: IcicleLayoutController<TNodeData, TEdgeData, TPosition>;
  clickedNode?: IcicleNode<TNodeData, TEdgeData, TPosition> | null;
}

/**
 * A DOM-independent icicle tree layout.
 *
 * The class keeps the 2.0.1 geometry semantics, including using the complete
 * tree depth to size each level while laying out a selected subtree. Graph and
 * canvas implementations are supplied by the caller, so importing this module
 * has no registration or browser side effects.
 */
export class IcicleLayout<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
  TPosition extends IciclePosition = IciclePosition,
> {
  readonly graph: Graph<TNodeData, TEdgeData, TPosition>;
  root: string;
  readonly getSize: () => IcicleCanvasSize;
  readonly config: Readonly<ResolvedIcicleLayoutConfig>;
  readonly controller: IcicleLayoutController<
    TNodeData,
    TEdgeData,
    TPosition
  >;
  clickedNode: IcicleNode<TNodeData, TEdgeData, TPosition> | null;
  orientation: IcicleOrientation;

  constructor(
    dependencies: IcicleLayoutDependencies<
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
    };
    this.clickedNode = dependencies.clickedNode ?? null;

    const config = dependencies.config || {};
    this.config = {
      ...config,
      orientation: config.orientation ?? "h",
      offset: config.offset ?? 2,
      levelsToShow: config.levelsToShow ?? Number.MAX_VALUE,
      constrained: config.constrained ?? false,
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
    const root = this.requireNode(this.root);
    const { width, height } = this.getSize();
    const levelsToShow = this.config.constrained
      ? this.config.levelsToShow
      : Number.MAX_VALUE;

    this.controller.onBeforeCompute(root);
    this.graph.computeLevels(root.id, 0, "ignore");

    let treeDepth = 0;
    root.eachLevel(0, false, (_node, depth) => {
      if (depth > treeDepth) {
        treeDepth = depth;
      }
    });

    const startNode = this.requireNode(this.clickedNode?.id || root.id);
    const maximumDepth = Math.min(treeDepth, levelsToShow - 1);

    if (this.horizontal()) {
      this.computeSubtree(
        startNode,
        -width / 2,
        -height / 2,
        width / (maximumDepth + 1),
        height,
        property,
      );
      return;
    }

    this.computeSubtree(
      startNode,
      -width / 2,
      -height / 2,
      width,
      height / (maximumDepth + 1),
      property,
    );
  }

  computeSubtree(
    root: IcicleNode<TNodeData, TEdgeData, TPosition>,
    x: number,
    y: number,
    width: number,
    height: number,
    property: PositionPhase,
  ): void {
    const position = root.getPos(property);
    if (!position) {
      throw new Error(`Unknown graph position phase: ${property}`);
    }
    position.setc(x, y);
    root.setData("width", width, property);
    root.setData("height", height, property);

    const children = root.getSubnodes([1, 1], "ignore") as Array<
      IcicleNode<TNodeData, TEdgeData, TPosition>
    >;
    if (children.length === 0) {
      return;
    }

    let totalDimension = 0;
    for (const child of children) {
      totalDimension += child.getData<number>("dim");
    }

    for (const child of children) {
      if (this.horizontal()) {
        const nodeLength =
          (height * child.getData<number>("dim")) / totalDimension;
        this.computeSubtree(
          child,
          x + width,
          y,
          width,
          nodeLength,
          property,
        );
        y += nodeLength;
      } else {
        const nodeLength =
          (width * child.getData<number>("dim")) / totalDimension;
        this.computeSubtree(
          child,
          x,
          y + height,
          nodeLength,
          height,
          property,
        );
        x += nodeLength;
      }
    }
  }

  private requireNode(
    id: string,
  ): IcicleNode<TNodeData, TEdgeData, TPosition> {
    const node = this.graph.getNode(id);
    if (!node) {
      throw new Error(`Unknown graph node: ${id}`);
    }
    return node;
  }
}
