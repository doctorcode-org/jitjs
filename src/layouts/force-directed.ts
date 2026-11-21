import { Complex } from "../core/geometry.js";
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

export interface ForceDirectedCanvasSize {
  width: number;
  height: number;
}

export interface ForceDirectedLayoutConfig extends Record<string, unknown> {
  iterations?: number;
  levelDistance?: number;
}

export interface ResolvedForceDirectedLayoutConfig
  extends ForceDirectedLayoutConfig {
  iterations: number;
  levelDistance: number;
}

export interface ForceDirectedOptions {
  width: number;
  height: number;
  tstart: number;
  t?: number;
  nodef(distance: number): number;
  edgef(distance: number): number;
}

export interface ForceDirectedIncrementalOptions {
  /** Number of simulation iterations performed before yielding. */
  iter: number;
  onStep(percentage: number): void;
  onComplete(): void;
}

export type ForceDirectedTimer = (
  callback: () => void,
  delayMilliseconds: number,
) => unknown;

export type ForceDirectedGraph<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
> = Graph<TNodeData, TEdgeData, Complex>;

export type ForceDirectedNode<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
> = GraphNode<TNodeData, TEdgeData, Complex> & {
  disp?: Partial<Record<PositionPhase, Complex>>;
  visited?: boolean;
};

export type ForceDirectedNodeDimensionComputer<
  TNodeData extends NodeData,
  TEdgeData extends EdgeData,
> = (
  graph: ForceDirectedGraph<TNodeData, TEdgeData>,
  properties: readonly PositionPhase[],
  config: Readonly<ResolvedForceDirectedLayoutConfig>,
) => void;

export interface ForceDirectedLayoutDependencies<
  TNodeData extends NodeData,
  TEdgeData extends EdgeData,
> {
  graph: ForceDirectedGraph<TNodeData, TEdgeData>;
  root: string;
  /** Supplies the usable canvas dimensions without importing a canvas module. */
  getSize: () => ForceDirectedCanvasSize;
  config?: ForceDirectedLayoutConfig;
  random?: () => number;
  timer?: ForceDirectedTimer;
  computeNodeDimensions?: ForceDirectedNodeDimensionComputer<
    TNodeData,
    TEdgeData
  >;
}

const defaultTimer: ForceDirectedTimer = (callback, delayMilliseconds) =>
  globalThis.setTimeout(callback, delayMilliseconds);

/**
 * A DOM-independent Fruchterman-Reingold layout compatible with JIT's
 * force-directed simulation semantics.
 */
export class ForceDirectedLayout<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
> {
  readonly graph: ForceDirectedGraph<TNodeData, TEdgeData>;
  readonly root: string;
  readonly config: Readonly<ResolvedForceDirectedLayoutConfig>;
  readonly getSize: () => ForceDirectedCanvasSize;
  readonly random: () => number;
  readonly timer: ForceDirectedTimer;
  readonly computeNodeDimensions: ForceDirectedNodeDimensionComputer<
    TNodeData,
    TEdgeData
  >;

  constructor(
    dependencies: ForceDirectedLayoutDependencies<TNodeData, TEdgeData>,
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

  getOptions(): ForceDirectedOptions {
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
    incremental?: ForceDirectedIncrementalOptions,
  ): void {
    const properties = splat(
      property || (["current", "start", "end"] as const),
    ) as PositionPhase[];
    const options = this.getOptions();

    this.computeNodeDimensions(this.graph, properties, this.config);
    this.graph.computeLevels(this.root, 0, "ignore");

    this.graph.eachNode((graphNode) => {
      const node = graphNode as ForceDirectedNode<TNodeData, TEdgeData>;

      for (const phase of properties) {
        const position = node.getPos(phase) as Complex;
        if (position.equals(Complex.KER)) {
          position.x = (options.width / 5) * (this.random() - 0.5);
          position.y = (options.height / 5) * (this.random() - 0.5);
        }
      }

      node.disp = {};
      for (const phase of properties) {
        node.disp[phase] = new Complex(0, 0);
      }
    });

    this.computePositions(properties, options, incremental);
  }

  computePositions(
    properties: readonly PositionPhase[],
    options: ForceDirectedOptions,
    incremental?: ForceDirectedIncrementalOptions,
  ): void {
    const iterations = this.config.iterations;
    let iteration = 0;

    if (incremental) {
      const iterate = (): void => {
        for (let index = 0; index < incremental.iter; index += 1) {
          options.t = options.tstart;
          if (iterations) {
            options.t *= 1 - iteration++ / (iterations - 1);
          }
          this.computePositionStep(properties, options);

          if (iterations && iteration >= iterations) {
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
    options: ForceDirectedOptions,
  ): void {
    const displacement = new Complex(0, 0);

    // Repulsive forces between every pair of nodes.
    this.graph.eachNode((graphNode) => {
      const node = graphNode as ForceDirectedNode<TNodeData, TEdgeData>;
      const nodeDisplacements = this.getDisplacements(node, properties);

      for (const phase of properties) {
        const value = nodeDisplacements[phase] as Complex;
        value.x = 0;
        value.y = 0;
      }

      this.graph.eachNode((otherGraphNode) => {
        if (otherGraphNode.id == node.id) {
          return;
        }

        for (const phase of properties) {
          const position = node.getPos(phase) as Complex;
          const otherPosition = otherGraphNode.getPos(phase) as Complex;
          displacement.x = position.x - otherPosition.x;
          displacement.y = position.y - otherPosition.y;
          const norm = displacement.norm() || 1;
          (nodeDisplacements[phase] as Complex).$add(
            displacement.$scale(options.nodef(norm) / norm),
          );
        }
      });
    });

    // Attractive forces. The visited bit retains the legacy one-pass edge
    // traversal while allowing Graph.eachAdjacency to orient each edge.
    const root = this.graph.getNode(this.root) as
      | ForceDirectedNode<TNodeData, TEdgeData>
      | undefined;
    if (!root) {
      throw new Error(`Unknown graph root: ${this.root}`);
    }
    const traversalState = Boolean(root.visited);

    this.graph.eachNode((graphNode) => {
      const node = graphNode as ForceDirectedNode<TNodeData, TEdgeData>;
      const nodeDisplacements = this.getDisplacements(node, properties);

      node.eachAdjacency((adjacency) => {
        const target = adjacency.nodeTo as ForceDirectedNode<
          TNodeData,
          TEdgeData
        >;
        if (Boolean(target.visited) !== traversalState) {
          return;
        }
        const targetDisplacements = this.getDisplacements(target, properties);

        for (const phase of properties) {
          const position = node.getPos(phase) as Complex;
          const targetPosition = target.getPos(phase) as Complex;
          displacement.x = position.x - targetPosition.x;
          displacement.y = position.y - targetPosition.y;
          const norm = displacement.norm() || 1;
          nodeDisplacements[phase]?.$add(
            displacement.$scale(-options.edgef(norm) / norm),
          );
          targetDisplacements[phase]?.$add(displacement.$scale(-1));
        }
      });
      node.visited = !traversalState;
    });

    // Move nodes by no more than the current temperature and clamp them to
    // the centered canvas bounds.
    const temperature = options.t as number;
    const halfWidth = options.width / 2;
    const halfHeight = options.height / 2;

    this.graph.eachNode((graphNode) => {
      const node = graphNode as ForceDirectedNode<TNodeData, TEdgeData>;
      const nodeDisplacements = this.getDisplacements(node, properties);

      for (const phase of properties) {
        const value = nodeDisplacements[phase] as Complex;
        const norm = value.norm() || 1;
        const position = node.getPos(phase) as Complex;
        position.$add(
          new Complex(
            (value.x * Math.min(Math.abs(value.x), temperature)) / norm,
            (value.y * Math.min(Math.abs(value.y), temperature)) / norm,
          ),
        );
        position.x = Math.min(halfWidth, Math.max(-halfWidth, position.x));
        position.y = Math.min(halfHeight, Math.max(-halfHeight, position.y));
      }
    });
  }

  private getDisplacements(
    node: ForceDirectedNode<TNodeData, TEdgeData>,
    properties: readonly PositionPhase[],
  ): Partial<Record<PositionPhase, Complex>> {
    const displacements = (node.disp ||= {});
    for (const phase of properties) {
      displacements[phase] ||= new Complex(0, 0);
    }
    return displacements;
  }
}
