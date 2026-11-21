import type { PositionPhase } from "../../types.js";

export type GraphRemovalType =
  | "nothing"
  | "replot"
  | "fade"
  | "fade:seq"
  | "fade:con"
  | "iter";

export interface RemovableElement {
  ignore?: unknown;
  setData(property: string, value: unknown, phase?: PositionPhase): void;
}

export interface RemovalGraph<
  TNode extends RemovableElement,
  TEdge extends RemovableElement,
> {
  getNode(id: string): TNode | undefined;
  removeNode(id: string): void;
  getAdjacence(fromId: string, toId: string): TEdge | false | undefined;
  removeAdjacence(fromId: string, toId: string): void;
}

export interface GraphRemovalOptions extends Record<string, unknown> {
  type?: GraphRemovalType;
  duration?: number;
  hideLabels?: boolean;
  fps?: number;
  onComplete?: () => void;
}

export interface ResolvedGraphRemovalOptions extends GraphRemovalOptions {
  type: GraphRemovalType;
  duration: number;
  hideLabels: boolean;
  fps: number;
  onComplete: () => void;
}

export interface RemovalAnimationOptions extends ResolvedGraphRemovalOptions {
  modes: string[];
}

export interface RemovalSequenceOptions {
  condition(): boolean;
  step(): void;
  onComplete(): void;
  duration: number;
}

export interface GraphRemovalDependencies<
  TNode extends RemovableElement,
  TEdge extends RemovableElement,
> {
  graph: RemovalGraph<TNode, TEdge>;
  clearLabels(): void;
  refresh(replot?: boolean): void;
  reposition(): void;
  animate(options: RemovalAnimationOptions): void;
  sequence(options: RemovalSequenceOptions): void;
}

export type EdgeEndpoints = [fromId: string, toId: string];
export type EdgeRemovalInput = EdgeEndpoints | EdgeEndpoints[];

export function resolveGraphRemovalOptions(
  options: GraphRemovalOptions = {},
): ResolvedGraphRemovalOptions {
  return {
    type: "nothing",
    duration: 2000,
    hideLabels: true,
    fps: 30,
    onComplete: () => {},
    ...options,
  } as ResolvedGraphRemovalOptions;
}

/** Remove one or more nodes with Graph.Op's synchronous `nothing` semantics. */
export function removeNodesFromGraph<
  TNode extends RemovableElement,
  TEdge extends RemovableElement,
>(
  graph: RemovalGraph<TNode, TEdge>,
  input: string | readonly string[],
): void {
  const ids = Array.isArray(input) ? input : [input];
  for (const id of ids) {
    graph.removeNode(id);
  }
}

/** Remove one or more edges with Graph.Op's synchronous `nothing` semantics. */
export function removeEdgesFromGraph<
  TNode extends RemovableElement,
  TEdge extends RemovableElement,
>(
  graph: RemovalGraph<TNode, TEdge>,
  input: EdgeRemovalInput,
): void {
  const edges = normalizeEdges(input);
  for (const [fromId, toId] of edges) {
    graph.removeAdjacence(fromId, toId);
  }
}

/**
 * Execute Graph.Op.removeNode while keeping graph, animation, labels, and
 * sequencing behind injected interfaces.
 */
export function runNodeRemoval<
  TNode extends RemovableElement,
  TEdge extends RemovableElement,
>(
  dependencies: GraphRemovalDependencies<TNode, TEdge>,
  input: string | readonly string[],
  requestedOptions: GraphRemovalOptions = {},
): void {
  const options = resolveGraphRemovalOptions(requestedOptions);
  // Legacy splat returns an array input itself; iter mode therefore consumes it.
  const ids = (Array.isArray(input) ? input : [input]) as string[];
  const remove = () => removeNodesFromGraph(dependencies.graph, ids);

  switch (options.type) {
    case "nothing":
      remove();
      return;

    case "replot":
      remove();
      dependencies.clearLabels();
      dependencies.refresh(true);
      return;

    case "fade":
    case "fade:seq":
      for (const id of ids) {
        // Deliberately retain legacy's missing-node failure for fade modes.
        (dependencies.graph.getNode(id) as TNode).setData("alpha", 0, "end");
      }
      dependencies.animate({
        ...options,
        modes: ["node-property:alpha"],
        onComplete() {
          remove();
          dependencies.clearLabels();
          dependencies.reposition();
          dependencies.animate({ ...options, modes: ["linear"] });
        },
      });
      return;

    case "fade:con":
      for (const id of ids) {
        const node = dependencies.graph.getNode(id) as TNode;
        node.setData("alpha", 0, "end");
        node.ignore = true;
      }
      dependencies.reposition();
      dependencies.animate({
        ...options,
        modes: ["node-property:alpha", "linear"],
        onComplete() {
          remove();
          options.onComplete();
        },
      });
      return;

    case "iter":
      dependencies.sequence({
        condition: () => ids.length !== 0,
        step() {
          removeNodesFromGraph(dependencies.graph, ids.shift() as string);
          dependencies.clearLabels();
        },
        onComplete: options.onComplete,
        duration: Math.ceil(options.duration / ids.length),
      });
      return;
  }
}

/** Graph.Op.removeEdge with all policies expressed through dependencies. */
export function runEdgeRemoval<
  TNode extends RemovableElement,
  TEdge extends RemovableElement,
>(
  dependencies: GraphRemovalDependencies<TNode, TEdge>,
  input: EdgeRemovalInput,
  requestedOptions: GraphRemovalOptions = {},
): void {
  const options = resolveGraphRemovalOptions(requestedOptions);
  // As in legacy code, multi-edge iter mode consumes the caller's outer array.
  const edges = normalizeEdges(input);
  const remove = () => removeEdgesFromGraph(dependencies.graph, edges);

  switch (options.type) {
    case "nothing":
      remove();
      return;

    case "replot":
      remove();
      dependencies.refresh(true);
      return;

    case "fade":
    case "fade:seq":
      for (const [fromId, toId] of edges) {
        const adjacency = dependencies.graph.getAdjacence(fromId, toId);
        if (adjacency) {
          adjacency.setData("alpha", 0, "end");
        }
      }
      dependencies.animate({
        ...options,
        modes: ["edge-property:alpha"],
        onComplete() {
          remove();
          dependencies.reposition();
          dependencies.animate({ ...options, modes: ["linear"] });
        },
      });
      return;

    case "fade:con":
      for (const [fromId, toId] of edges) {
        const adjacency = dependencies.graph.getAdjacence(fromId, toId);
        if (adjacency) {
          adjacency.setData("alpha", 0, "end");
          adjacency.ignore = true;
        }
      }
      dependencies.reposition();
      dependencies.animate({
        ...options,
        modes: ["edge-property:alpha", "linear"],
        onComplete() {
          remove();
          options.onComplete();
        },
      });
      return;

    case "iter":
      dependencies.sequence({
        condition: () => edges.length !== 0,
        step() {
          removeEdgesFromGraph(
            dependencies.graph,
            edges.shift() as EdgeEndpoints,
          );
          dependencies.clearLabels();
        },
        onComplete: options.onComplete,
        duration: Math.ceil(options.duration / edges.length),
      });
      return;
  }
}

function normalizeEdges(input: EdgeRemovalInput): EdgeEndpoints[] {
  return typeof input[0] === "string"
    ? [input as EdgeEndpoints]
    : (input as EdgeEndpoints[]);
}
