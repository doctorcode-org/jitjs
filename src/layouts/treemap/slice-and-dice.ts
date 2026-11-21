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
  TreemapLayoutController,
  TreemapLayoutDependencies,
  TreemapNode,
  TreemapOrientation,
  TreemapPosition,
} from "./types.js";

/** Alternating slice-and-dice treemap with no runtime graph dependency. */
export class SliceAndDiceTreemapLayout<
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

  compute(property?: PositionPhase): void {
    const root = this.requireNode(this.clickedNode?.id || this.root);
    this.controller.onBeforeCompute(root);

    const { width, height } = this.getSize();
    this.graph.computeLevels(this.root, 0, "ignore");
    (root.getPos(property) as TPosition).setc(-width / 2, -height / 2);
    root.setData("width", width, property);
    root.setData("height", height + this.config.titleHeight, property);

    this.computePositions(
      root,
      root,
      this.orientation,
      property,
    );
    this.controller.onAfterCompute(root);
  }

  computePositions(
    parent: TreemapNode<TNodeData, TEdgeData, TPosition>,
    child: TreemapNode<TNodeData, TEdgeData, TPosition>,
    requestedOrientation: TreemapOrientation,
    property?: PositionPhase,
  ): void {
    let totalArea = 0;
    parent.eachSubnode((node) => {
      // The generic assertion intentionally leaves JavaScript's legacy `+`
      // coercion intact for callers crossing the untyped boundary.
      totalArea += node.getData<number>("area", property);
    });

    const width = parent.getData<number>("width", property);
    const height = Math.max(
      parent.getData<number>("height", property) -
        this.config.titleHeight,
      0,
    );
    const factor = parent === child
      ? 1
      : child.getData<number>("area", property) / totalArea;

    let orientation: TreemapOrientation;
    let otherSize: number;
    let size: number;
    let dimension: "width" | "height";
    let positionAxis: "x" | "y";
    let otherPositionAxis: "x" | "y";
    let titleOffset: number;
    let otherTitleOffset: number;

    if (requestedOrientation === "h") {
      orientation = "v";
      otherSize = height;
      size = width * factor;
      dimension = "height";
      positionAxis = "y";
      otherPositionAxis = "x";
      titleOffset = this.config.titleHeight;
      otherTitleOffset = 0;
    } else {
      orientation = "h";
      otherSize = height * factor;
      size = width;
      dimension = "width";
      positionAxis = "x";
      otherPositionAxis = "y";
      titleOffset = 0;
      otherTitleOffset = this.config.titleHeight;
    }

    const childPosition = child.getPos(property) as TPosition;
    child.setData("width", size, property);
    child.setData("height", otherSize, property);

    let offsetSize = 0;
    child.eachSubnode((node) => {
      const position = node.getPos(property) as TPosition;
      position[positionAxis] =
        offsetSize + childPosition[positionAxis] + titleOffset;
      position[otherPositionAxis] =
        childPosition[otherPositionAxis] + otherTitleOffset;
      this.computePositions(child, node, orientation, property);
      offsetSize += node.getData<number>(dimension, property);
    });
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
