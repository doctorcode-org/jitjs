import type { EdgeData, NodeData } from "../../types.js";
import type { Graph, GraphPosition } from "../graph.js";

/**
 * Reconcile a target graph with an incoming graph using Graph.Op.morph's
 * synchronous `nothing` semantics. Existing data objects are patched in
 * place; missing edges and nodes are removed after additions are processed.
 */
export function morphIntoGraph<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
  TPosition extends GraphPosition = GraphPosition,
>(
  target: Graph<TNodeData, TEdgeData, TPosition>,
  incoming: Graph<TNodeData, TEdgeData, TPosition>,
): void {
  incoming.eachNode((node) => {
    const nodeExists = target.hasNode(node.id);

    node.eachAdjacency((adjacency) => {
      const fromId = adjacency.nodeFrom.id;
      const toId = adjacency.nodeTo.id;
      const adjacencyExists = Boolean(target.getAdjacence(fromId, toId));

      target.addAdjacence(
        adjacency.nodeFrom,
        adjacency.nodeTo,
        adjacency.data,
      );

      if (adjacencyExists) {
        const added = target.getAdjacence(fromId, toId);
        if (added) {
          for (const property in adjacency.data || {}) {
            added.data[property] = adjacency.data[property];
          }
        }
      }
    });

    if (nodeExists) {
      const added = target.getNode(node.id);
      if (added) {
        for (const property in node.data || {}) {
          added.data[property] = node.data[property];
        }
      }
    }
  });

  target.eachNode((node) => {
    node.eachAdjacency((adjacency) => {
      const fromId = adjacency.nodeFrom.id;
      const toId = adjacency.nodeTo.id;
      if (!incoming.getAdjacence(fromId, toId)) {
        target.removeAdjacence(fromId, toId);
      }
    });

    if (!incoming.hasNode(node.id)) {
      target.removeNode(node.id);
    }
  });
}
