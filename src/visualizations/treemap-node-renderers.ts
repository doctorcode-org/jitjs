import { hexToRgb, rgbToHex } from "../core/util.js";
import type { RenderPoint } from "../graph/rendering/contracts.js";
import { containsRectangle } from "../graph/rendering/node-shapes.js";
import type {
  TreemapLeafPredicate,
  TreemapRenderableNode,
  TreemapRendererConfig,
  TreemapRenderingCanvas,
} from "./treemap-renderer-contracts.js";

function cushionColor(color: string): string {
  const values = hexToRgb(color) as readonly [number, number, number];
  const shaded: [number, number, number] = [
    (values[0] * 0.2) >> 0,
    (values[1] * 0.2) >> 0,
    (values[2] * 0.2) >> 0,
  ];
  return rgbToHex(shaded) as string;
}

export function renderTreemapNoneNode(
  _type: string,
  _node: TreemapRenderableNode,
  _canvas: TreemapRenderingCanvas,
  _animating?: boolean,
  _config?: TreemapRendererConfig,
  _leaf?: TreemapLeafPredicate,
  _clickedNode?: TreemapRenderableNode | null,
): void {}

export function renderTreemapRectangleNode(
  _type: string,
  node: TreemapRenderableNode,
  canvas: TreemapRenderingCanvas,
  _animating?: boolean,
  config: TreemapRendererConfig = {},
  leaf: TreemapLeafPredicate = () => false,
  _clickedNode?: TreemapRenderableNode | null,
): void {
  const isLeaf = leaf(node);
  const offset = config.offset ?? 2;
  const titleHeight = config.titleHeight ?? 13;
  const position = node.pos.getc(true);
  const width = node.getData<number>("width");
  const height = node.getData<number>("height");
  const border = node.getData<unknown>("border");
  const context = canvas.getCtx();
  const x = position.x + offset / 2;
  const y = position.y + offset / 2;
  if (width <= offset || height <= offset) {
    return;
  }

  if (isLeaf) {
    if (config.cushion) {
      const gradient = context.createRadialGradient(
        x + (width - offset) / 2,
        y + (height - offset) / 2,
        1,
        x + (width - offset) / 2,
        y + (height - offset) / 2,
        width < height ? height : width,
      );
      const color = node.getData<string>("color");
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, cushionColor(color));
      context.fillStyle = gradient;
    }
    context.fillRect(x, y, width - offset, height - offset);
    if (border) {
      context.save();
      context.strokeStyle = border;
      context.strokeRect(x, y, width - offset, height - offset);
      context.restore();
    }
  } else if (titleHeight > 0) {
    context.fillRect(
      position.x + offset / 2,
      position.y + offset / 2,
      width - offset,
      titleHeight - offset,
    );
    if (border) {
      context.save();
      context.strokeStyle = border;
      context.strokeRect(
        position.x + offset / 2,
        position.y + offset / 2,
        width - offset,
        height - offset,
      );
      context.restore();
    }
  }
}

export function containsTreemapRectangleNode(
  node: TreemapRenderableNode,
  position: RenderPoint,
  config: TreemapRendererConfig = {},
  leaf: TreemapLeafPredicate = () => false,
  clickedNode?: TreemapRenderableNode | null,
): boolean {
  if (
    (clickedNode && !node.isDescendantOf(clickedNode.id)) ||
    Boolean(node.ignore)
  ) {
    return false;
  }
  const nodePosition = node.pos.getc(true);
  const width = node.getData<number>("width");
  const height = leaf(node)
    ? node.getData<number>("height")
    : (config.titleHeight ?? 13);
  return containsRectangle(
    { x: nodePosition.x + width / 2, y: nodePosition.y + height / 2 },
    position,
    width,
    height,
  );
}
