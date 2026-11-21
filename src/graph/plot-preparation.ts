import type {
  Graph,
  GraphPosition,
} from "./graph.js";
import type {
  EdgeData,
  NodeData,
} from "../types.js";

export type PlotModeProperties = string | readonly string[];

export interface PlotModesObject extends Record<string, PlotModeProperties> {
  position?: string;
}

export type PlotModesInput = readonly string[] | PlotModesObject;
export type NormalizedPlotModes = Record<string, string[]>;

/**
 * Convert both legacy mode syntaxes into the map consumed by animation.
 * Unknown mode names are intentionally retained for custom interpolators.
 */
export function normalizePlotModes(
  modes: PlotModesInput,
): NormalizedPlotModes {
  const normalized: NormalizedPlotModes = {};

  if (Array.isArray(modes)) {
    for (const mode of modes) {
      const parts = mode.split(":");
      const name = parts.shift() as string;
      normalized[name] = parts;
    }
    return normalized;
  }

  const objectModes = modes as PlotModesObject;
  for (const name in objectModes) {
    const value = objectModes[name] as PlotModeProperties;
    if (name === "position") {
      normalized[value as string] = [];
    } else {
      normalized[name] = Array.isArray(value)
        ? (value as string[])
        : [value as string];
    }
  }
  return normalized;
}

/**
 * Snapshot graph positions and selected element properties into their start
 * phases before animation. All Graph imports are type-only.
 */
export function prepareGraphForAnimation<
  TNodeData extends NodeData = NodeData,
  TEdgeData extends EdgeData = EdgeData,
  TPosition extends GraphPosition = GraphPosition,
>(
  graph: Graph<TNodeData, TEdgeData, TPosition>,
  modes: PlotModesInput,
): NormalizedPlotModes {
  const normalized = normalizePlotModes(modes);

  graph.eachNode((node) => {
    node.startPos.set(node.pos as never);

    for (const property of normalized["node-property"] ?? []) {
      node.setData(property, node.getData(property), "start");
    }
    for (const property of normalized["node-style"] ?? []) {
      node.setCanvasStyle(
        property,
        node.getCanvasStyle(property),
        "start",
      );
    }

    const edgeProperties = normalized["edge-property"];
    const edgeStyles = normalized["edge-style"];
    if (edgeProperties || edgeStyles) {
      node.eachAdjacency((adjacency) => {
        for (const property of edgeProperties ?? []) {
          adjacency.setData(property, adjacency.getData(property), "start");
        }
        for (const property of edgeStyles ?? []) {
          adjacency.setCanvasStyle(
            property,
            adjacency.getCanvasStyle(property),
            "start",
          );
        }
      });
    }
  });

  return normalized;
}
