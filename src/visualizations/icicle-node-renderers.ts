import { hexToRgb, rgbToHex } from "../core/util.js";
import type { RenderPoint } from "../graph/rendering/contracts.js";
import { containsRectangle } from "../graph/rendering/node-shapes.js";
import type {
  IcicleRenderableNode,
  IcicleRendererConfig,
  IcicleRenderingCanvas,
} from "./icicle-renderer-contracts.js";

function cushionColor(color: string): string {
  const values = hexToRgb(color) as readonly [number, number, number];
  const shaded: [number, number, number] = [
    (values[0] * 0.3) >> 0,
    (values[1] * 0.3) >> 0,
    (values[2] * 0.3) >> 0,
  ];
  return rgbToHex(shaded) as string;
}

export function renderIcicleNoneNode(
  _type: string,
  _node: IcicleRenderableNode,
  _canvas: IcicleRenderingCanvas,
  _animating?: boolean,
  _config?: IcicleRendererConfig,
  _clickedNode?: IcicleRenderableNode | null,
): void {}

export function containsIcicleNoneNode(
  _node: IcicleRenderableNode,
  _position: RenderPoint,
  _config?: IcicleRendererConfig,
  _clickedNode?: IcicleRenderableNode | null,
): false {
  return false;
}

export function renderIcicleRectangleNode(
  _type: string,
  node: IcicleRenderableNode,
  canvas: IcicleRenderingCanvas,
  _animating?: boolean,
  config: IcicleRendererConfig = {},
  _clickedNode?: IcicleRenderableNode | null,
): void {
  const offset = config.offset ?? 2;
  const width = node.getData<number>("width");
  const height = node.getData<number>("height");
  const border = node.getData<unknown>("border");
  const position = node.pos.getc(true);
  const x = position.x + offset / 2;
  const y = position.y + offset / 2;
  const context = canvas.getCtx();

  if (width - offset < 2 || height - offset < 2) {
    return;
  }

  if (config.cushion) {
    const color = node.getData<string>("color");
    const gradient = context.createRadialGradient(
      x + (width - offset) / 2,
      y + (height - offset) / 2,
      1,
      x + (width - offset) / 2,
      y + (height - offset) / 2,
      width < height ? height : width,
    );
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, cushionColor(color));
    context.fillStyle = gradient;
  }

  if (border) {
    context.strokeStyle = border;
    context.lineWidth = 3;
  }

  context.fillRect(
    x,
    y,
    Math.max(0, width - offset),
    Math.max(0, height - offset),
  );
  if (border) {
    context.strokeRect(position.x, position.y, width, height);
  }
}

export function containsIcicleRectangleNode(
  node: IcicleRenderableNode,
  position: RenderPoint,
  _config: IcicleRendererConfig = {},
  clickedNode?: IcicleRenderableNode | null,
): boolean {
  if (clickedNode && !node.isDescendantOf(clickedNode.id)) {
    return false;
  }
  const nodePosition = node.pos.getc(true);
  const width = node.getData<number>("width");
  const height = node.getData<number>("height");
  return containsRectangle(
    {
      x: nodePosition.x + width / 2,
      y: nodePosition.y + height / 2,
    },
    position,
    width,
    height,
  );
}
