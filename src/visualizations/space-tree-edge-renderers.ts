import type { RenderPoint } from "../graph/rendering/contracts.js";
import {
  containsArrow,
  containsLine,
  renderArrow,
  renderLine,
} from "../graph/rendering/edge-shapes.js";
import type {
  SpaceTreeOrientation,
  SpaceTreeRenderableEdge,
  SpaceTreeRenderableNode,
  SpaceTreeRendererConfig,
  SpaceTreeRenderingCanvas,
} from "./space-tree-renderer-contracts.js";

type EdgeEnd = "begin" | "end";

/** Resolve the orientation exactly as ST.Plot#getOrientation does. */
export function getSpaceTreeEdgeOrientation(
  edge: SpaceTreeRenderableEdge,
  config: SpaceTreeRendererConfig,
): SpaceTreeOrientation {
  let orientation: unknown = config.orientation;
  if (config.multitree) {
    orientation =
      ("$orn" in edge.nodeFrom.data && edge.nodeFrom.data.$orn) ||
      ("$orn" in edge.nodeTo.data && edge.nodeTo.data.$orn);
  }
  return orientation as SpaceTreeOrientation;
}

function orientedOffset(
  orientation: SpaceTreeOrientation,
  top: RenderPoint,
  right: RenderPoint,
  bottom: RenderPoint,
  left: RenderPoint,
): RenderPoint | undefined {
  switch (orientation) {
    case "top":
      return top;
    case "right":
      return right;
    case "bottom":
      return bottom;
    case "left":
      return left;
  }
  return undefined;
}

/** Port of ST.Geom#getEdge, kept independent from the SpaceTree facade. */
export function getSpaceTreeEdgePosition(
  node: SpaceTreeRenderableNode,
  end: EdgeEnd,
  orientation: SpaceTreeOrientation,
  config: SpaceTreeRendererConfig,
): RenderPoint {
  const width = node.getData<number>("width");
  const height = node.getData<number>("height");
  const alignment = config.Node.align;
  let offset: RenderPoint | undefined;

  if (end === "begin") {
    if (alignment === "center") {
      offset = orientedOffset(
        orientation,
        { x: 0, y: height / 2 },
        { x: -width / 2, y: 0 },
        { x: 0, y: -height / 2 },
        { x: width / 2, y: 0 },
      );
    } else if (alignment === "left") {
      offset = orientedOffset(
        orientation,
        { x: 0, y: height },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: width, y: 0 },
      );
    } else if (alignment === "right") {
      offset = orientedOffset(
        orientation,
        { x: 0, y: 0 },
        { x: -width, y: 0 },
        { x: 0, y: -height },
        { x: 0, y: 0 },
      );
    } else {
      throw "align: not implemented";
    }
  } else if (alignment === "center") {
    offset = orientedOffset(
      orientation,
      { x: 0, y: -height / 2 },
      { x: width / 2, y: 0 },
      { x: 0, y: height / 2 },
      { x: -width / 2, y: 0 },
    );
  } else if (alignment === "left") {
    offset = orientedOffset(
      orientation,
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: 0, y: height },
      { x: 0, y: 0 },
    );
  } else if (alignment === "right") {
    offset = orientedOffset(
      orientation,
      { x: 0, y: -height },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: -width, y: 0 },
    );
  } else {
    throw "align: not implemented";
  }

  // An invalid orientation made legacy dispatch return undefined and fail on
  // the subsequent helper access. The cast retains that runtime behavior.
  return node.pos.add(offset as RenderPoint);
}

function depthOrderedEndpoints(
  edge: SpaceTreeRenderableEdge,
  config: SpaceTreeRendererConfig,
): { from: RenderPoint; to: RenderPoint; orientation: SpaceTreeOrientation } {
  const orientation = getSpaceTreeEdgeOrientation(edge, config);
  const forward = edge.nodeFrom._depth < edge.nodeTo._depth;
  return {
    from: getSpaceTreeEdgePosition(
      forward ? edge.nodeFrom : edge.nodeTo,
      "begin",
      orientation,
      config,
    ),
    to: getSpaceTreeEdgePosition(
      forward ? edge.nodeTo : edge.nodeFrom,
      "end",
      orientation,
      config,
    ),
    orientation,
  };
}

export function renderSpaceTreeNoneEdge(
  _type: string,
  _edge: SpaceTreeRenderableEdge,
  _canvas: SpaceTreeRenderingCanvas,
  _animating: boolean | undefined,
  _config: SpaceTreeRendererConfig,
): void {}

export function containsSpaceTreeNoneEdge(
  _edge: SpaceTreeRenderableEdge,
  _position: RenderPoint,
  _epsilon: number,
  _config: SpaceTreeRendererConfig,
): false {
  return false;
}

export function renderSpaceTreeLineEdge(
  _type: string,
  edge: SpaceTreeRenderableEdge,
  canvas: SpaceTreeRenderingCanvas,
  _animating: boolean | undefined,
  config: SpaceTreeRendererConfig,
): void {
  const { from, to } = depthOrderedEndpoints(edge, config);
  renderLine(from, to, canvas);
}

export function containsSpaceTreeLineEdge(
  edge: SpaceTreeRenderableEdge,
  position: RenderPoint,
  epsilon: number,
  config: SpaceTreeRendererConfig,
): boolean {
  const { from, to } = depthOrderedEndpoints(edge, config);
  return containsLine(from, to, position, epsilon);
}

export function renderSpaceTreeArrowEdge(
  _type: string,
  edge: SpaceTreeRenderableEdge,
  canvas: SpaceTreeRenderingCanvas,
  _animating: boolean | undefined,
  config: SpaceTreeRendererConfig,
): void {
  const orientation = getSpaceTreeEdgeOrientation(edge, config);
  const node = edge.nodeFrom;
  const child = edge.nodeTo;
  const dimension = edge.getData<number>("dim");
  const from = getSpaceTreeEdgePosition(
    node,
    "begin",
    orientation,
    config,
  );
  const to = getSpaceTreeEdgePosition(
    child,
    "end",
    orientation,
    config,
  );
  const direction = edge.data.$direction as
    | ArrayLike<unknown>
    | null
    | undefined;
  const inverted = Boolean(
    direction && direction.length > 1 && direction[0] != node.id,
  );
  renderArrow(from, to, dimension, inverted, canvas);
}

export function containsSpaceTreeArrowEdge(
  edge: SpaceTreeRenderableEdge,
  position: RenderPoint,
  epsilon: number,
  config: SpaceTreeRendererConfig,
): boolean {
  const { from, to } = depthOrderedEndpoints(edge, config);
  return containsArrow(from, to, position, epsilon);
}

export function renderSpaceTreeQuadraticBeginEdge(
  _type: string,
  edge: SpaceTreeRenderableEdge,
  canvas: SpaceTreeRenderingCanvas,
  _animating: boolean | undefined,
  config: SpaceTreeRendererConfig,
): void {
  const { from: begin, to: end, orientation } = depthOrderedEndpoints(
    edge,
    config,
  );
  const dimension = edge.getData<number>("dim");
  const context = canvas.getCtx();
  context.beginPath();
  context.moveTo(begin.x, begin.y);
  switch (orientation) {
    case "left":
      context.quadraticCurveTo(
        begin.x + dimension,
        begin.y,
        end.x,
        end.y,
      );
      break;
    case "right":
      context.quadraticCurveTo(
        begin.x - dimension,
        begin.y,
        end.x,
        end.y,
      );
      break;
    case "top":
      context.quadraticCurveTo(
        begin.x,
        begin.y + dimension,
        end.x,
        end.y,
      );
      break;
    case "bottom":
      context.quadraticCurveTo(
        begin.x,
        begin.y - dimension,
        end.x,
        end.y,
      );
      break;
  }
  context.stroke();
}

export function renderSpaceTreeQuadraticEndEdge(
  _type: string,
  edge: SpaceTreeRenderableEdge,
  canvas: SpaceTreeRenderingCanvas,
  _animating: boolean | undefined,
  config: SpaceTreeRendererConfig,
): void {
  const { from: begin, to: end, orientation } = depthOrderedEndpoints(
    edge,
    config,
  );
  const dimension = edge.getData<number>("dim");
  const context = canvas.getCtx();
  context.beginPath();
  context.moveTo(begin.x, begin.y);
  switch (orientation) {
    case "left":
      context.quadraticCurveTo(
        end.x - dimension,
        end.y,
        end.x,
        end.y,
      );
      break;
    case "right":
      context.quadraticCurveTo(
        end.x + dimension,
        end.y,
        end.x,
        end.y,
      );
      break;
    case "top":
      context.quadraticCurveTo(
        end.x,
        end.y - dimension,
        end.x,
        end.y,
      );
      break;
    case "bottom":
      context.quadraticCurveTo(
        end.x,
        end.y + dimension,
        end.x,
        end.y,
      );
      break;
  }
  context.stroke();
}

export function renderSpaceTreeBezierEdge(
  _type: string,
  edge: SpaceTreeRenderableEdge,
  canvas: SpaceTreeRenderingCanvas,
  _animating: boolean | undefined,
  config: SpaceTreeRendererConfig,
): void {
  const { from: begin, to: end, orientation } = depthOrderedEndpoints(
    edge,
    config,
  );
  const dimension = edge.getData<number>("dim");
  const context = canvas.getCtx();
  context.beginPath();
  context.moveTo(begin.x, begin.y);
  switch (orientation) {
    case "left":
      context.bezierCurveTo(
        begin.x + dimension,
        begin.y,
        end.x - dimension,
        end.y,
        end.x,
        end.y,
      );
      break;
    case "right":
      context.bezierCurveTo(
        begin.x - dimension,
        begin.y,
        end.x + dimension,
        end.y,
        end.x,
        end.y,
      );
      break;
    case "top":
      context.bezierCurveTo(
        begin.x,
        begin.y + dimension,
        end.x,
        end.y - dimension,
        end.x,
        end.y,
      );
      break;
    case "bottom":
      context.bezierCurveTo(
        begin.x,
        begin.y - dimension,
        end.x,
        end.y + dimension,
        end.x,
        end.y,
      );
      break;
  }
  context.stroke();
}
