import { Polar } from "../../core/geometry.js";
import { merge } from "../../core/util.js";

export type GraphTransformType =
  | "nothing"
  | "replot"
  | "fade"
  | "fade:seq"
  | "fade:con"
  | string;

export interface GraphTransformOptions extends Record<string, unknown> {
  type?: GraphTransformType;
  duration?: number;
  hideLabels?: boolean;
  fps?: number;
  id?: string;
  onComplete?: () => void;
}

export interface ResolvedGraphTransformOptions
  extends GraphTransformOptions {
  type: GraphTransformType;
  duration: number;
  hideLabels: boolean;
  fps: number;
  onComplete: () => void;
}

export interface GraphTransformPosition {
  isZero(): boolean;
  set(position: this): void;
  getp(): { equals(position: { theta: number; rho: number }): boolean };
}

export interface GraphTransformElement {
  data: Record<string, unknown>;
  startData: Record<string, unknown>;
  endData: Record<string, unknown>;
  ignore?: unknown;
  setData(
    property: string,
    value: unknown,
    phase?: "current" | "start" | "end",
  ): void;
}

export interface GraphTransformNode<
  TPosition extends GraphTransformPosition,
  TEdge extends GraphTransformEdge<TPosition, GraphTransformNode<TPosition, TEdge>>,
> extends GraphTransformElement {
  id: string;
  pos: TPosition;
  startPos: TPosition;
  endPos: TPosition;
  startAlpha?: unknown;
  endAlpha?: unknown;
  adjacentTo(node: this): boolean;
  eachAdjacency(visit: (edge: TEdge) => void): void;
}

export interface GraphTransformEdge<
  TPosition extends GraphTransformPosition,
  TNode extends GraphTransformNode<TPosition, GraphTransformEdge<TPosition, TNode>>,
> extends GraphTransformElement {
  nodeFrom: TNode;
  nodeTo: TNode;
}

export interface GraphTransformGraph<
  TPosition extends GraphTransformPosition,
  TNode extends GraphTransformNode<TPosition, TEdge>,
  TEdge extends GraphTransformEdge<TPosition, TNode>,
> {
  hasNode(id: string): boolean;
  getNode(id: string): TNode | undefined;
  addNode(node: TNode): TNode;
  removeNode(id: string): void;
  eachNode(visit: (node: TNode) => void): void;
  getAdjacence(fromId: string, toId: string): TEdge | false | undefined;
  addAdjacence(from: TNode, to: TNode, data: Record<string, unknown>): TEdge;
  removeAdjacence(fromId: string, toId: string): void;
}

export interface GraphTransformAnimationOptions
  extends ResolvedGraphTransformOptions {
  modes: string[];
}

export interface GraphTransformVisualization<
  TJson,
  TPosition extends GraphTransformPosition,
  TNode extends GraphTransformNode<TPosition, TEdge>,
  TEdge extends GraphTransformEdge<TPosition, TNode>,
  TGraph extends GraphTransformGraph<TPosition, TNode, TEdge>,
> {
  graph: TGraph;
  root: string;
  controller?: Readonly<Record<string, unknown>>;
  construct(json: TJson): TGraph;
  refresh(replot?: boolean): void;
  reposition?(): void;
  compute?(phase: "end"): void;
  clearLabels(force?: boolean): void;
  animate(options: GraphTransformAnimationOptions): void;
}

export interface GraphMorphExtraModes extends Record<string, unknown> {
  "node-property"?: string | readonly string[];
  "edge-property"?: string | readonly string[];
  "label-property"?: string | readonly string[];
  position?: string;
}

const transformDefaults = {
  type: "nothing",
  duration: 2000,
  hideLabels: true,
  fps: 30,
  onComplete() {},
} as const;

export function resolveGraphTransformOptions(
  controller: Readonly<Record<string, unknown>> = {},
  requested: GraphTransformOptions = {},
): ResolvedGraphTransformOptions {
  return merge(
    transformDefaults,
    controller,
    requested,
  ) as ResolvedGraphTransformOptions;
}

/** Prepare newly added nodes and edges using Graph.Op.preprocessSum semantics. */
export function preprocessGraphSum<
  TPosition extends GraphTransformPosition,
  TNode extends GraphTransformNode<TPosition, TEdge>,
  TEdge extends GraphTransformEdge<TPosition, TNode>,
  TGraph extends GraphTransformGraph<TPosition, TNode, TEdge>,
>(target: TGraph, incoming: TGraph): boolean {
  incoming.eachNode((node) => {
    if (!target.hasNode(node.id)) {
      target.addNode(node);
      const added = target.getNode(node.id) as TNode;
      added.setData("alpha", 0);
      added.setData("alpha", 0, "start");
      added.setData("alpha", 1, "end");
    }
  });

  let fadeEdges = false;
  incoming.eachNode((node) => {
    node.eachAdjacency((incomingEdge) => {
      const nodeFrom = target.getNode(incomingEdge.nodeFrom.id) as TNode;
      const nodeTo = target.getNode(incomingEdge.nodeTo.id) as TNode;
      if (!nodeFrom.adjacentTo(nodeTo)) {
        const added = target.addAdjacence(
          nodeFrom,
          nodeTo,
          incomingEdge.data,
        );
        // These direct fields are intentionally retained: in 2.0.1 they are
        // usually both undefined, which makes existing-endpoint edges fade.
        if (
          nodeFrom.startAlpha == nodeFrom.endAlpha &&
          nodeTo.startAlpha == nodeTo.endAlpha
        ) {
          fadeEdges = true;
          added.setData("alpha", 0);
          added.setData("alpha", 0, "start");
          added.setData("alpha", 1, "end");
        }
      }
    });
  });
  return fadeEdges;
}

/** Full Graph.Op.sum policy, isolated from the synchronous sum kernel. */
export function runGraphSum<
  TJson,
  TPosition extends GraphTransformPosition,
  TNode extends GraphTransformNode<TPosition, TEdge>,
  TEdge extends GraphTransformEdge<TPosition, TNode>,
  TGraph extends GraphTransformGraph<TPosition, TNode, TEdge>,
>(
  visualization: GraphTransformVisualization<
    TJson,
    TPosition,
    TNode,
    TEdge,
    TGraph
  >,
  json: TJson,
  requested: GraphTransformOptions = {},
): void {
  const options = resolveGraphTransformOptions(
    visualization.controller,
    requested,
  );
  const originalRoot = visualization.root;
  visualization.root = requested.id || visualization.root;

  switch (options.type) {
    case "nothing":
      sumGraphSynchronously(visualization.graph, visualization.construct(json));
      return;

    case "replot":
      visualization.refresh(true);
      runGraphSum(visualization, json, { type: "nothing" });
      visualization.refresh(true);
      return;

    case "fade":
    case "fade:seq":
    case "fade:con": {
      const incoming = visualization.construct(json);
      const fadeEdges = preprocessGraphSum(visualization.graph, incoming);
      const modes = fadeEdges
        ? ["node-property:alpha", "edge-property:alpha"]
        : ["node-property:alpha"];
      visualization.reposition?.();
      if (options.type !== "fade:con") {
        visualization.animate({
          ...options,
          modes: ["linear"],
          onComplete() {
            visualization.animate({
              ...options,
              modes,
              onComplete() {
                options.onComplete();
              },
            });
          },
        });
      } else {
        visualization.graph.eachNode((node) => {
          if (node.id !== originalRoot && node.pos.isZero()) {
            node.pos.set(node.endPos);
            node.startPos.set(node.endPos);
          }
        });
        visualization.animate({
          ...options,
          modes: ["linear", ...modes],
        });
      }
      return;
    }

    default:
      throw new Error(`Unknown graph sum operation: ${options.type}`);
  }
}

/** Full Graph.Op.morph policy, including extra property animation modes. */
export function runGraphMorph<
  TJson,
  TPosition extends GraphTransformPosition,
  TNode extends GraphTransformNode<TPosition, TEdge>,
  TEdge extends GraphTransformEdge<TPosition, TNode>,
  TGraph extends GraphTransformGraph<TPosition, TNode, TEdge>,
>(
  visualization: GraphTransformVisualization<
    TJson,
    TPosition,
    TNode,
    TEdge,
    TGraph
  >,
  json: TJson,
  requested: GraphTransformOptions = {},
  extraModes: GraphMorphExtraModes = {},
): void {
  const options = resolveGraphTransformOptions(
    visualization.controller,
    requested,
  );
  const originalRoot = visualization.root;
  visualization.root = requested.id || visualization.root;

  switch (options.type) {
    case "nothing":
      morphGraphSynchronously(
        visualization.graph,
        visualization.construct(json),
      );
      return;

    case "replot":
      visualization.clearLabels(true);
      runGraphMorph(visualization, json, { type: "nothing" });
      visualization.refresh(true);
      visualization.refresh(true);
      return;

    case "fade":
    case "fade:seq":
    case "fade:con": {
      const incoming = visualization.construct(json);
      const nodeProperties =
        "node-property" in extraModes
          ? splatStrings(extraModes["node-property"]).map(
              (property) => `$${property}`,
            )
          : false;
      let fadeEdges = false;

      visualization.graph.eachNode((node) => {
        const incomingNode = incoming.getNode(node.id);
        if (!incomingNode) {
          node.setData("alpha", 1);
          node.setData("alpha", 1, "start");
          node.setData("alpha", 0, "end");
          node.ignore = true;
        } else {
          for (const property in incomingNode.data) {
            if (nodeProperties && nodeProperties.indexOf(property) > -1) {
              node.endData[property] = incomingNode.data[property];
            } else {
              node.data[property] = incomingNode.data[property];
            }
          }
        }
      });

      visualization.graph.eachNode((node) => {
        if (node.ignore) return;
        node.eachAdjacency((edge) => {
          if (edge.nodeFrom.ignore || edge.nodeTo.ignore) return;
          const incomingFrom = incoming.getNode(edge.nodeFrom.id) as TNode;
          const incomingTo = incoming.getNode(edge.nodeTo.id) as TNode;
          if (!incomingFrom.adjacentTo(incomingTo)) {
            const removed = visualization.graph.getAdjacence(
              incomingFrom.id,
              incomingTo.id,
            ) as TEdge;
            fadeEdges = true;
            removed.setData("alpha", 1);
            removed.setData("alpha", 1, "start");
            removed.setData("alpha", 0, "end");
          }
        });
      });

      fadeEdges = preprocessGraphSum(
        visualization.graph,
        incoming,
      ) || fadeEdges;
      const modes = fadeEdges
        ? ["node-property:alpha", "edge-property:alpha"]
        : ["node-property:alpha"];
      modes[0] = `${modes[0]}${
        "node-property" in extraModes
          ? `:${splatStrings(extraModes["node-property"]).join(":")}`
          : ""
      }`;
      modes[1] = `${modes[1] || "edge-property:alpha"}${
        "edge-property" in extraModes
          ? `:${splatStrings(extraModes["edge-property"]).join(":")}`
          : ""
      }`;
      if ("label-property" in extraModes) {
        modes.push(
          `label-property:${splatStrings(extraModes["label-property"]).join(":")}`,
        );
      }

      if (visualization.reposition) visualization.reposition();
      else visualization.compute?.("end");
      visualization.graph.eachNode((node) => {
        if (
          node.id !== originalRoot &&
          node.pos.getp().equals(Polar.KER)
        ) {
          node.pos.set(node.endPos);
          node.startPos.set(node.endPos);
        }
      });
      visualization.animate({
        ...options,
        modes: [extraModes.position || "polar", ...modes],
        onComplete() {
          visualization.graph.eachNode((node) => {
            if (node.ignore) visualization.graph.removeNode(node.id);
          });
          visualization.graph.eachNode((node) => {
            node.eachAdjacency((edge) => {
              if (edge.ignore) {
                visualization.graph.removeAdjacence(
                  edge.nodeFrom.id,
                  edge.nodeTo.id,
                );
              }
            });
          });
          options.onComplete();
        },
      });
      return;
    }

    default:
      return;
  }
}

function sumGraphSynchronously<
  TPosition extends GraphTransformPosition,
  TNode extends GraphTransformNode<TPosition, TEdge>,
  TEdge extends GraphTransformEdge<TPosition, TNode>,
  TGraph extends GraphTransformGraph<TPosition, TNode, TEdge>,
>(target: TGraph, incoming: TGraph): void {
  incoming.eachNode((node) => {
    node.eachAdjacency((edge) => {
      target.addAdjacence(edge.nodeFrom, edge.nodeTo, edge.data);
    });
  });
}

function morphGraphSynchronously<
  TPosition extends GraphTransformPosition,
  TNode extends GraphTransformNode<TPosition, TEdge>,
  TEdge extends GraphTransformEdge<TPosition, TNode>,
  TGraph extends GraphTransformGraph<TPosition, TNode, TEdge>,
>(target: TGraph, incoming: TGraph): void {
  incoming.eachNode((node) => {
    const nodeExists = target.hasNode(node.id);
    node.eachAdjacency((edge) => {
      const fromId = edge.nodeFrom.id;
      const toId = edge.nodeTo.id;
      const edgeExists = Boolean(target.getAdjacence(fromId, toId));
      target.addAdjacence(edge.nodeFrom, edge.nodeTo, edge.data);
      if (edgeExists) {
        const added = target.getAdjacence(fromId, toId) as TEdge;
        for (const property in edge.data || {}) {
          added.data[property] = edge.data[property];
        }
      }
    });
    if (nodeExists) {
      const added = target.getNode(node.id) as TNode;
      for (const property in node.data || {}) {
        added.data[property] = node.data[property];
      }
    }
  });
  target.eachNode((node) => {
    node.eachAdjacency((edge) => {
      if (!incoming.getAdjacence(edge.nodeFrom.id, edge.nodeTo.id)) {
        target.removeAdjacence(edge.nodeFrom.id, edge.nodeTo.id);
      }
    });
    if (!incoming.hasNode(node.id)) target.removeNode(node.id);
  });
}

function splatStrings(value: unknown): string[] {
  return (Array.isArray(value) ? value : [value]) as string[];
}
