import type { EdgeData, NodeData } from "../../types.js";
import type { Graph, GraphPosition } from "../graph.js";

/**
 * Add the connected portion of one graph to another using the synchronous
 * semantics of Graph.Op.sum's `nothing` mode.
 *
 * Construction, root selection, refreshing, labels, and animation remain
 * outside this mutation kernel so the emitted module has no runtime imports.
 */
export function sumIntoGraph<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
  TPosition extends GraphPosition = GraphPosition,
>(
  target: Graph<TNodeData, TEdgeData, TPosition>,
  incoming: Graph<TNodeData, TEdgeData, TPosition>,
): void {
  incoming.eachNode((node) => {
    node.eachAdjacency((adjacency) => {
      target.addAdjacence(
        adjacency.nodeFrom,
        adjacency.nodeTo,
        adjacency.data,
      );
    });
  });
}
