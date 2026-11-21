import { splat } from "../core/util.js";
import { Vector3 } from "../geometry/vector3.js";
import type {
  Graph,
  GraphNode,
} from "../graph/graph.js";
import type {
  EdgeData,
  NodeData,
  PositionPhase,
} from "../types.js";

export interface ForceDirected3DCanvasSize {
  width: number;
  height: number;
}

export interface ForceDirected3DLayoutConfig extends Record<string, unknown> {
  iterations?: number;
  levelDistance?: number;
}

export interface ResolvedForceDirected3DLayoutConfig
  extends ForceDirected3DLayoutConfig {
  iterations: number;
  levelDistance: number;
}

export interface ForceDirected3DOptions {
  width: number;
  height: number;
  tstart: number;
  t?: number;
  nodef(distance: number): number;
  edgef(distance: number): number;
}

export interface ForceDirected3DIncrementalOptions {
  /** Number of simulation iterations performed before yielding. */
  iter: number;
  onStep(percentage: number): void;
  onComplete(): void;
}

export type ForceDirected3DTimer = (
  callback: () => void,
  delayMilliseconds: number,
) => unknown;

export type ForceDirected3DGraph<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
> = Graph<TNodeData, TEdgeData, Vector3>;

export type ForceDirected3DNode<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
> = GraphNode<TNodeData, TEdgeData, Vector3> & {
  disp?: Partial<Record<PositionPhase, Vector3>>;
  visited?: boolean;
};

export type ForceDirected3DNodeDimensionComputer<
  TNodeData extends NodeData,
  TEdgeData extends EdgeData,
> = (
  graph: ForceDirected3DGraph<TNodeData, TEdgeData>,
  properties: readonly PositionPhase[],
  config: Readonly<ResolvedForceDirected3DLayoutConfig>,
) => void;

export interface ForceDirected3DLayoutDependencies<
  TNodeData extends NodeData,
  TEdgeData extends EdgeData,
> {
  graph: ForceDirected3DGraph<TNodeData, TEdgeData>;
  root: string;
  /** Supplies the usable canvas dimensions without importing a canvas module. */
  getSize: () => ForceDirected3DCanvasSize;
  config?: ForceDirected3DLayoutConfig;
  random?: () => number;
  timer?: ForceDirected3DTimer;
  computeNodeDimensions?: ForceDirected3DNodeDimensionComputer<
    TNodeData,
    TEdgeData
  >;
}

const defaultTimer: ForceDirected3DTimer = (callback, delayMilliseconds) =>
  globalThis.setTimeout(callback, delayMilliseconds);

/**
 * DOM- and renderer-independent 3D force-directed layout retaining the
 * original JIT simulation and cooling semantics.
 */
export class ForceDirected3DLayout<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
> {
  readonly graph: ForceDirected3DGraph<TNodeData, TEdgeData>;
  readonly root: string;
  readonly config: Readonly<ResolvedForceDirected3DLayoutConfig>;
  readonly getSize: () => ForceDirected3DCanvasSize;
  readonly random: () => number;
  readonly timer: ForceDirected3DTimer;
  readonly computeNodeDimensions: ForceDirected3DNodeDimensionComputer<
    TNodeData,
    TEdgeData
  >;

  constructor(
    dependencies: ForceDirected3DLayoutDependencies<TNodeData, TEdgeData>,
  ) {
    this.graph = dependencies.graph;
    this.root = dependencies.root;
    this.getSize = dependencies.getSize;
    this.random = dependencies.random || Math.random;
    this.timer = dependencies.timer || defaultTimer;
    this.computeNodeDimensions =
      dependencies.computeNodeDimensions || (() => {});

    const config = dependencies.config || {};
    this.config = {
      ...config,
      iterations: config.iterations ?? 50,
      levelDistance: config.levelDistance ?? 50,
    };
  }

  getOptions(): ForceDirected3DOptions {
    const { width, height } = this.getSize();
    let nodeCount = 0;
    this.graph.eachNode(() => {
      nodeCount += 1;
    });

    const idealDistanceSquared = (width * height) / nodeCount;
    const idealDistance = Math.sqrt(idealDistanceSquared);
    const levelDistance = this.config.levelDistance;

    return {
      width,
      height,
      tstart: width * 0.1,
      nodef: (distance) => idealDistanceSquared / (distance || 1),
      edgef: (distance) => idealDistance * (distance - levelDistance),
    };
  }

  compute(
    property?: PositionPhase | readonly PositionPhase[],
    incremental?: ForceDirected3DIncrementalOptions,
  ): void {
    const properties = splat(
      property || (["current", "start", "end"] as const),
    ) as PositionPhase[];
    const options = this.getOptions();

    this.computeNodeDimensions(this.graph, properties, this.config);
    this.graph.computeLevels(this.root, 0, "ignore");

    this.graph.eachNode((graphNode) => {
      const node = graphNode as ForceDirected3DNode<TNodeData, TEdgeData>;

      for (const phase of properties) {
        const position = node.getPos(phase) as Vector3;
        if (position.isZero()) {
          position.x = (options.width / 5) * (this.random() - 0.5);
          position.y = (options.height / 5) * (this.random() - 0.5);
          position.z = 200 * (this.random() - 0.5);
        }

        // The source recreated this map once per phase. Keeping that quirk
        // preserves allocation and final initialization order exactly.
        node.disp = {};
        for (const displacementPhase of properties) {
          node.disp[displacementPhase] = new Vector3(0, 0, 0);
        }
      }
    });

    this.computePositions(properties, options, incremental);
  }

  computePositions(
    properties: readonly PositionPhase[],
    options: ForceDirected3DOptions,
    incremental?: ForceDirected3DIncrementalOptions,
  ): void {
    const iterations = this.config.iterations;
    let iteration = 0;

    if (incremental) {
      const iterate = (): void => {
        for (let index = 0; index < incremental.iter; index += 1) {
          options.t =
            options.tstart * (1 - iteration++ / (iterations - 1));
          this.computePositionStep(properties, options);

          if (iteration >= iterations) {
            incremental.onComplete();
            return;
          }
        }

        incremental.onStep(
          Math.round((iteration / (iterations - 1)) * 100),
        );
        this.timer(iterate, 1);
      };

      iterate();
      return;
    }

    for (; iteration < iterations; iteration += 1) {
      options.t =
        options.tstart * (1 - iteration / (iterations - 1));
      this.computePositionStep(properties, options);
    }
  }

  computePositionStep(
    properties: readonly PositionPhase[],
    options: ForceDirected3DOptions,
  ): void {
    const displacement = new Vector3(0, 0, 0);

    // Repulsive forces between every pair of nodes.
    this.graph.eachNode((graphNode) => {
      const node = graphNode as ForceDirected3DNode<TNodeData, TEdgeData>;
      const nodeDisplacements = this.getDisplacements(node, properties);

      for (const phase of properties) {
        const value = nodeDisplacements[phase] as Vector3;
        value.x = 0;
        value.y = 0;
        value.z = 0;
      }

      this.graph.eachNode((otherGraphNode) => {
        if (otherGraphNode.id == node.id) {
          return;
        }

        for (const phase of properties) {
          const position = node.getPos(phase) as Vector3;
          const otherPosition = otherGraphNode.getPos(phase) as Vector3;
          displacement.x = position.x - otherPosition.x;
          displacement.y = position.y - otherPosition.y;
          displacement.z = position.z - otherPosition.z;
          const norm = displacement.norm() || 1;
          (nodeDisplacements[phase] as Vector3).$add(
            displacement.$scale(options.nodef(norm) / norm),
          );
        }
      });
    });

    // The visited bit retains the source's one-pass undirected edge traversal.
    const root = this.graph.getNode(this.root) as
      | ForceDirected3DNode<TNodeData, TEdgeData>
      | undefined;
    if (!root) {
      throw new Error(`Unknown graph root: ${this.root}`);
    }
    const traversalState = Boolean(root.visited);

    this.graph.eachNode((graphNode) => {
      const node = graphNode as ForceDirected3DNode<TNodeData, TEdgeData>;
      const nodeDisplacements = this.getDisplacements(node, properties);

      node.eachAdjacency((adjacency) => {
        const target = adjacency.nodeTo as ForceDirected3DNode<
          TNodeData,
          TEdgeData
        >;
        if (Boolean(target.visited) !== traversalState) {
          return;
        }
        const targetDisplacements = this.getDisplacements(target, properties);

        for (const phase of properties) {
          const position = node.getPos(phase) as Vector3;
          const targetPosition = target.getPos(phase) as Vector3;
          displacement.x = position.x - targetPosition.x;
          displacement.y = position.y - targetPosition.y;
          displacement.z = position.z - targetPosition.z;
          const norm = displacement.norm() || 1;
          (nodeDisplacements[phase] as Vector3).$add(
            displacement.$scale(-options.edgef(norm) / norm),
          );
          (targetDisplacements[phase] as Vector3).$add(
            displacement.$scale(-1),
          );
        }
      });
      node.visited = !traversalState;
    });

    // JIT deliberately uses half the canvas height as the z-axis bound.
    const temperature = options.t as number;
    const halfWidth = options.width / 2;
    const halfHeight = options.height / 2;

    this.graph.eachNode((graphNode) => {
      const node = graphNode as ForceDirected3DNode<TNodeData, TEdgeData>;
      const nodeDisplacements = this.getDisplacements(node, properties);

      for (const phase of properties) {
        const value = nodeDisplacements[phase] as Vector3;
        const norm = value.norm() || 1;
        const position = node.getPos(phase) as Vector3;
        position.$add(
          new Vector3(
            (value.x * Math.min(Math.abs(value.x), temperature)) / norm,
            (value.y * Math.min(Math.abs(value.y), temperature)) / norm,
            (value.z * Math.min(Math.abs(value.z), temperature)) / norm,
          ),
        );
        position.x = Math.min(
          halfWidth,
          Math.max(-halfWidth, position.x),
        );
        position.y = Math.min(
          halfHeight,
          Math.max(-halfHeight, position.y),
        );
        position.z = Math.min(
          halfHeight,
          Math.max(-halfHeight, position.z),
        );
      }
    });
  }

  private getDisplacements(
    node: ForceDirected3DNode<TNodeData, TEdgeData>,
    properties: readonly PositionPhase[],
  ): Partial<Record<PositionPhase, Vector3>> {
    const displacements = (node.disp ||= {});
    for (const phase of properties) {
      displacements[phase] ||= new Vector3(0, 0, 0);
    }
    return displacements;
  }
}
