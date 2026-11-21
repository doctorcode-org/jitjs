import type { PositionPhase } from "../types.js";

export interface NodeFxNode {
  id: string;
  setData(property: string, value: unknown, phase?: PositionPhase): void;
}

export interface NodeFxGraph<TNode extends NodeFxNode> {
  eachNode(visit: (node: TNode) => void): void;
  getNode(id: string): TNode | undefined;
}

export interface NodeFxElements {
  /** A falsy value targets every node, matching Graph.Plot.nodeFx. */
  id?: string | readonly string[] | false | null;
  properties?: Record<string, unknown>;
}

export interface NodeFxOptions extends Record<string, unknown> {
  elements?: NodeFxElements;
  reposition?: boolean;
}

export interface ResolvedNodeFxBaseOptions extends NodeFxOptions {
  elements: {
    id: string | readonly string[] | false | null;
    properties: Record<string, unknown>;
  };
}

export interface ResolvedNodeFxOptions extends ResolvedNodeFxBaseOptions {
  modes: string[];
  type: "nodefx";
}

export interface NodeFxDependencies<
  TNode extends NodeFxNode,
  TResult = unknown,
> {
  graph: NodeFxGraph<TNode>;
  stop(): void;
  computeEnd(): void;
  animate(options: ResolvedNodeFxOptions): TResult;
}

/**
 * Resolve the small nodeFx-specific option layer without importing a general
 * configuration merger. The visualization config remains the caller's job.
 */
export function resolveNodeFxOptions(
  options: NodeFxOptions = {},
): ResolvedNodeFxBaseOptions {
  return {
    ...options,
    elements: {
      id: false,
      properties: {},
      ...options.elements,
    },
  };
}

/**
 * Apply node-property targets and return the exact plot modes that legacy
 * Graph.Plot.nodeFx passes to its animation layer.
 */
export function prepareNodeFx<TNode extends NodeFxNode>(
  graph: NodeFxGraph<TNode>,
  elements: ResolvedNodeFxOptions["elements"],
  reposition = false,
  computeEnd: () => void = () => {},
): string[] {
  const properties = elements.properties;

  if (!elements.id) {
    graph.eachNode((node) => {
      for (const property in properties) {
        node.setData(property, properties[property], "end");
      }
    });
  } else {
    const ids = Array.isArray(elements.id) ? elements.id : [elements.id];
    for (const id of ids) {
      const node = graph.getNode(id);
      if (!node) {
        continue;
      }
      for (const property in properties) {
        node.setData(property, properties[property], "end");
      }
    }
  }

  const propertyNames: string[] = [];
  for (const property in properties) {
    propertyNames.push(property);
  }

  const modes = [`node-property:${propertyNames.join(":")}`];
  if (reposition) {
    modes.push("linear");
    computeEnd();
  }
  return modes;
}

/**
 * Renderer- and environment-independent Graph.Plot.nodeFx orchestration.
 * The animation driver is injected so importing this module does not pull in
 * Animation, Graph, interpolation, Canvas, or DOM code.
 */
export function runNodeFx<
  TNode extends NodeFxNode,
  TResult = unknown,
>(
  dependencies: NodeFxDependencies<TNode, TResult>,
  options: NodeFxOptions = {},
): TResult {
  const resolved = resolveNodeFxOptions(options);
  dependencies.stop();
  const modes = prepareNodeFx(
    dependencies.graph,
    resolved.elements,
    Boolean(resolved.reposition),
    dependencies.computeEnd,
  );
  return dependencies.animate({
    ...resolved,
    modes,
    type: "nodefx",
  });
}
