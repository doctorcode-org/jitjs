export interface EventInfoPoint {
  x: number;
  y: number;
}

export interface EventInfoCanvas {
  readonly translateOffsetX: number;
  readonly translateOffsetY: number;
  readonly scaleOffsetX: number;
  readonly scaleOffsetY: number;
  getSize(): { width: number; height: number };
  getPos(): EventInfoPoint;
}

export interface EventInfoGraph<TNode extends object, TEdge extends object> {
  readonly nodes: Readonly<Record<string, TNode | null | undefined>>;
  readonly edges: Readonly<
    Record<
      string,
      Readonly<Record<string, TEdge | null | undefined>>
    >
  >;
}

export type EventHitResult<TContains> =
  | TContains
  | false
  | null
  | undefined;

export interface EventInfoDependencies<
  TNode extends object,
  TEdge extends object,
  TEvent,
  TWindow,
  TNodeContains = boolean,
  TEdgeContains = TNodeContains,
> {
  readonly graph: EventInfoGraph<TNode, TEdge>;
  readonly canvas: EventInfoCanvas;
  resolvePointer(event: TEvent, targetWindow: TWindow | undefined): EventInfoPoint;
  hitTestNode(
    node: TNode,
    point: EventInfoPoint,
  ): EventHitResult<TNodeContains>;
  hitTestEdge(
    edge: TEdge,
    point: EventInfoPoint,
  ): EventHitResult<TEdgeContains>;
}

export interface EventInfo<
  TNode extends object,
  TEdge extends object,
  TNodeContains = boolean,
  TEdgeContains = TNodeContains,
> {
  pos: EventInfoPoint | false;
  node: TNode | false;
  edge: TEdge | false;
  contains: TNodeContains | TEdgeContains | false;
  getNodeCalled: boolean;
  getEdgeCalled: boolean;
  getPos(): EventInfoPoint;
  getNode(): TNode | false;
  getEdge(): TEdge | false;
  getContains(): TNodeContains | TEdgeContains | false;
}

/**
 * Build the lazy event facade used by the legacy extras without importing a
 * graph, canvas, DOM helper, or shape registry. Concrete hit-test policy is
 * supplied by the caller, keeping this module usable as an isolated leaf.
 */
export function createEventInfo<
  TNode extends object,
  TEdge extends object,
  TEvent,
  TWindow,
  TNodeContains = boolean,
  TEdgeContains = TNodeContains,
>(
  dependencies: EventInfoDependencies<
    TNode,
    TEdge,
    TEvent,
    TWindow,
    TNodeContains,
    TEdgeContains
  >,
  event: TEvent,
  targetWindow?: TWindow,
): EventInfo<TNode, TEdge, TNodeContains, TEdgeContains> {
  const { canvas, graph } = dependencies;

  return {
    pos: false,
    node: false,
    edge: false,
    contains: false,
    getNodeCalled: false,
    getEdgeCalled: false,

    getPos() {
      const size = canvas.getSize();
      const canvasPosition = canvas.getPos();
      const pointer = dependencies.resolvePointer(event, targetWindow);

      this.pos = {
        x:
          (pointer.x -
            canvasPosition.x -
            size.width / 2 -
            canvas.translateOffsetX) /
          canvas.scaleOffsetX,
        y:
          (pointer.y -
            canvasPosition.y -
            size.height / 2 -
            canvas.translateOffsetY) /
          canvas.scaleOffsetY,
      };
      return this.pos;
    },

    getNode() {
      if (this.getNodeCalled) {
        return this.node;
      }

      this.getNodeCalled = true;
      for (const id in graph.nodes) {
        const node = graph.nodes[id];
        const contains =
          node && dependencies.hitTestNode(node, this.getPos());
        if (contains) {
          this.contains = contains;
          return (this.node = node);
        }
      }

      return (this.node = false);
    },

    getEdge() {
      if (this.getEdgeCalled) {
        return this.edge;
      }

      this.getEdgeCalled = true;
      const visitedSources = new Set<string>();
      for (const id in graph.edges) {
        const edgesFromNode = graph.edges[id];
        visitedSources.add(id);

        for (const edgeId in edgesFromNode) {
          if (visitedSources.has(edgeId)) {
            continue;
          }

          const edge = edgesFromNode[edgeId];
          const contains =
            edge && dependencies.hitTestEdge(edge, this.getPos());
          if (contains) {
            this.contains = contains;
            return (this.edge = edge);
          }
        }
      }

      return (this.edge = false);
    },

    getContains() {
      if (this.getNodeCalled) {
        return this.contains;
      }
      this.getNode();
      return this.contains;
    },
  };
}
