import { Polar } from "../core/geometry.js";
import { splat } from "../core/util.js";
import type {
  Graph,
  GraphNode,
} from "../graph/graph.js";
import type {
  EdgeData,
  NodeData,
  PositionPhase,
} from "../types.js";

export type RadialGraph<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
> = Graph<TNodeData, TEdgeData, Polar>;

export type RadialNode<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
> = GraphNode<TNodeData, TEdgeData, Polar>;

export type LevelDistanceFunction<
  TNodeData extends NodeData,
  TEdgeData extends EdgeData,
> = (node: RadialNode<TNodeData, TEdgeData>) => number;

export type NodeDimensionComputer<
  TNodeData extends NodeData,
  TEdgeData extends EdgeData,
> = (
  graph: RadialGraph<TNodeData, TEdgeData>,
  properties: readonly PositionPhase[],
  config: Readonly<Record<string, unknown>>,
) => void;

export interface RadialLayoutDependencies<
  TNodeData extends NodeData,
  TEdgeData extends EdgeData,
> {
  graph: RadialGraph<TNodeData, TEdgeData>;
  root: string;
  config?: Readonly<Record<string, unknown>>;
  parent?: RadialNode<TNodeData, TEdgeData> | null;
  createLevelDistance: () => LevelDistanceFunction<TNodeData, TEdgeData>;
  computeNodeDimensions?: NodeDimensionComputer<TNodeData, TEdgeData>;
}

/** Pure graph-side radial layout shared by radial visualizations. */
export class RadialLayout<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
> {
  readonly graph: RadialGraph<TNodeData, TEdgeData>;
  readonly root: string;
  readonly config: Readonly<Record<string, unknown>>;
  parent: RadialNode<TNodeData, TEdgeData> | null;
  readonly createLevelDistance: () => LevelDistanceFunction<TNodeData, TEdgeData>;
  readonly computeNodeDimensions: NodeDimensionComputer<TNodeData, TEdgeData>;

  constructor(dependencies: RadialLayoutDependencies<TNodeData, TEdgeData>) {
    this.graph = dependencies.graph;
    this.root = dependencies.root;
    this.config = dependencies.config || {};
    this.parent = dependencies.parent || null;
    this.createLevelDistance = dependencies.createLevelDistance;
    this.computeNodeDimensions = dependencies.computeNodeDimensions || (() => {});
  }

  compute(
    property?: PositionPhase | readonly PositionPhase[],
  ): void {
    const properties = splat(
      property || (["current", "start", "end"] as const),
    ) as PositionPhase[];
    this.computeNodeDimensions(this.graph, properties, this.config);
    this.graph.computeLevels(this.root, 0, "ignore");
    const getLength = this.createLevelDistance();
    this.computeAngularWidths(properties);
    this.computePositions(properties, getLength);
  }

  computePositions(
    properties: readonly PositionPhase[],
    getLength: LevelDistanceFunction<TNodeData, TEdgeData>,
  ): void {
    const root = this.graph.getNode(this.root);
    if (!root) {
      throw new Error(`Unknown graph root: ${this.root}`);
    }

    for (const property of properties) {
      root.setPos(new Polar(0, 0), property);
      root.setData("span", Math.PI * 2, property);
    }
    root.angleSpan = { begin: 0, end: Math.PI * 2 };

    this.graph.eachBFS(this.root, (node) => {
      const angleSpan = node.angleSpan.end - node.angleSpan.begin;
      let angleStart = node.angleSpan.begin;
      const length = getLength(node);
      let totalAngularWidth = 0;
      const children: Array<RadialNode<TNodeData, TEdgeData>> = [];
      const maximumDimension: Partial<Record<PositionPhase, number>> = {};

      node.eachSubnode((child) => {
        totalAngularWidth += child._treeAngularWidth as number;
        for (const property of properties) {
          const dimension = child.getData<number>("dim", property);
          const currentMaximum = maximumDimension[property];
          maximumDimension[property] =
            currentMaximum === undefined
              ? dimension
              : dimension > currentMaximum
                ? dimension
                : currentMaximum;
        }
        children.push(child);
      }, "ignore");

      if (
        this.parent?.id === node.id &&
        children.length > 0 &&
        children[0]?.dist
      ) {
        children.sort(
          (left, right) =>
            (Number(left.dist) >= Number(right.dist) ? 1 : 0) -
            (Number(left.dist) <= Number(right.dist) ? 1 : 0),
        );
      }

      for (const child of children) {
        if (child._flag) {
          continue;
        }
        const proportion =
          ((child._treeAngularWidth as number) / totalAngularWidth) * angleSpan;
        const theta = angleStart + proportion / 2;
        for (const property of properties) {
          child.setPos(new Polar(theta, length), property);
          child.setData("span", proportion, property);
          child.setData(
            "dim-quotient",
            child.getData<number>("dim", property) /
              (maximumDimension[property] as number),
            property,
          );
        }
        child.angleSpan = {
          begin: angleStart,
          end: angleStart + proportion,
        };
        angleStart += proportion;
      }
    }, "ignore");
  }

  setAngularWidthForNodes(properties: readonly PositionPhase[]): void {
    this.graph.eachBFS(this.root, (node, depth) => {
      const angularWidth = node.getData<number>("angularWidth", properties[0]) || 5;
      node._angularWidth = angularWidth / (depth as number);
    }, "ignore");
  }

  setSubtreesAngularWidth(): void {
    this.graph.eachNode((node) => {
      this.setSubtreeAngularWidth(node);
    }, "ignore");
  }

  setSubtreeAngularWidth(node: RadialNode<TNodeData, TEdgeData>): void {
    const nodeAngularWidth = node._angularWidth as number;
    let childrenAngularWidth = 0;
    node.eachSubnode((child) => {
      this.setSubtreeAngularWidth(child);
      childrenAngularWidth += child._treeAngularWidth as number;
    }, "ignore");
    node._treeAngularWidth = Math.max(nodeAngularWidth, childrenAngularWidth);
  }

  computeAngularWidths(properties: readonly PositionPhase[]): void {
    this.setAngularWidthForNodes(properties);
    this.setSubtreesAngularWidth();
  }
}
