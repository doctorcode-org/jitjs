import { Polar } from "../core/geometry.js";
import { hexToRgb, rgbToHex } from "../core/util.js";
import type { RenderPoint } from "../graph/rendering/contracts.js";
import type {
  SunburstRenderableNode,
  SunburstRendererConfig,
  SunburstRenderingCanvas,
} from "./sunburst-renderer-contracts.js";

function levelDistance(config?: SunburstRendererConfig): number {
  return config?.levelDistance ?? 100;
}

function darken(color: string): string {
  const components = hexToRgb(color) as readonly [number, number, number];
  const darkened: [number, number, number] = [
    parseInt(String(components[0] * 0.5), 10),
    parseInt(String(components[1] * 0.5), 10),
    parseInt(String(components[2] * 0.5), 10),
  ];
  return rgbToHex(darkened) as string;
}

export function angleContainsSunburstNode(
  node: SunburstRenderableNode,
  position: RenderPoint,
): boolean {
  const span = node.getData<number>("span") / 2;
  const theta = node.pos.theta;
  let begin = theta - span;
  const end = theta + span;
  if (begin < 0) {
    begin += Math.PI * 2;
  }
  let angle = Math.atan2(position.y, position.x);
  if (angle < 0) {
    angle += Math.PI * 2;
  }
  return begin > end
    ? (angle > begin && angle <= Math.PI * 2) || angle < end
    : angle > begin && angle < end;
}

export function renderSunburstNoneNode(
  _type: string,
  _node: SunburstRenderableNode,
  _canvas: SunburstRenderingCanvas,
  _animating?: boolean,
  _config?: SunburstRendererConfig,
): void {}

export function containsSunburstNoneNode(
  _node: SunburstRenderableNode,
  _position: RenderPoint,
  _config?: SunburstRendererConfig,
): false {
  return false;
}

export function renderSunburstPieNode(
  _type: string,
  node: SunburstRenderableNode,
  canvas: SunburstRenderingCanvas,
  _animating?: boolean,
  _config?: SunburstRendererConfig,
): void {
  const span = node.getData<number>("span") / 2;
  const theta = node.pos.theta;
  const begin = theta - span;
  const end = theta + span;
  const polarNode = node.pos.getp(true);
  // Preserve the swapped constructor arguments in JIT 2.0.1.
  const polar = new Polar(polarNode.rho, begin);
  const first = polar.getc(true);
  polar.theta = end;
  const second = polar.getc(true);
  const context = canvas.getCtx();
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(first.x, first.y);
  context.moveTo(0, 0);
  context.lineTo(second.x, second.y);
  context.moveTo(0, 0);
  context.arc(
    0,
    0,
    polarNode.rho * node.getData<number>("dim-quotient"),
    begin,
    end,
    false,
  );
  context.fill();
}

export function containsSunburstPieNode(
  node: SunburstRenderableNode,
  position: RenderPoint,
  config?: SunburstRendererConfig,
): boolean {
  if (angleContainsSunburstNode(node, position)) {
    const rho = Math.sqrt(position.x * position.x + position.y * position.y);
    return rho <= levelDistance(config) * Number(node._depth);
  }
  return false;
}

export function renderSunburstMultipieNode(
  _type: string,
  node: SunburstRenderableNode,
  canvas: SunburstRenderingCanvas,
  _animating?: boolean,
  config?: SunburstRendererConfig,
): void {
  const height = node.getData<number>("height");
  const distance = height ? height : levelDistance(config);
  const span = node.getData<number>("span") / 2;
  const theta = node.pos.theta;
  const begin = theta - span;
  const end = theta + span;
  const polarNode = node.pos.getp(true);
  const polar = new Polar(polarNode.rho, begin);
  const first = polar.getc(true);
  polar.theta = end;
  const second = polar.getc(true);
  polar.rho += distance;
  const third = polar.getc(true);
  polar.theta = begin;
  const fourth = polar.getc(true);

  const context = canvas.getCtx();
  context.moveTo(0, 0);
  context.beginPath();
  context.arc(0, 0, polarNode.rho, begin, end, false);
  context.arc(0, 0, polarNode.rho + distance, end, begin, true);
  context.moveTo(first.x, first.y);
  context.lineTo(fourth.x, fourth.y);
  context.moveTo(second.x, second.y);
  context.lineTo(third.x, third.y);
  context.fill();

  if (node.collapsed) {
    context.save();
    context.lineWidth = 2;
    context.moveTo(0, 0);
    context.beginPath();
    context.arc(
      0,
      0,
      polarNode.rho + distance + 5,
      end - 0.01,
      begin + 0.01,
      true,
    );
    context.stroke();
    context.restore();
  }
}

export function containsSunburstMultipieNode(
  node: SunburstRenderableNode,
  position: RenderPoint,
  config?: SunburstRendererConfig,
): boolean {
  if (angleContainsSunburstNode(node, position)) {
    const rho = Math.sqrt(position.x * position.x + position.y * position.y);
    const height = node.getData<number>("height");
    const distance = height ? height : levelDistance(config);
    const base = levelDistance(config) * Number(node._depth);
    return rho >= base && rho <= base + distance;
  }
  return false;
}

export function renderSunburstGradientMultipieNode(
  type: string,
  node: SunburstRenderableNode,
  canvas: SunburstRenderingCanvas,
  animating?: boolean,
  config?: SunburstRendererConfig,
): void {
  const context = canvas.getCtx();
  const height = node.getData<number>("height");
  const distance = height ? height : levelDistance(config);
  const gradient = context.createRadialGradient(
    0,
    0,
    node.getPos().rho,
    0,
    0,
    node.getPos().rho + distance,
  );
  const color = node.getData<string>("color");
  gradient.addColorStop(0, darken(color));
  gradient.addColorStop(1, node.getData<string>("color"));
  context.fillStyle = gradient;
  renderSunburstMultipieNode(type, node, canvas, animating, config);
}

export function containsSunburstGradientMultipieNode(
  node: SunburstRenderableNode,
  position: RenderPoint,
  config?: SunburstRendererConfig,
): boolean {
  return containsSunburstMultipieNode(node, position, config);
}

export function renderSunburstGradientPieNode(
  type: string,
  node: SunburstRenderableNode,
  canvas: SunburstRenderingCanvas,
  animating?: boolean,
  config?: SunburstRendererConfig,
): void {
  const context = canvas.getCtx();
  const gradient = context.createRadialGradient(
    0,
    0,
    0,
    0,
    0,
    node.getPos().rho,
  );
  const color = node.getData<string>("color");
  gradient.addColorStop(1, darken(color));
  gradient.addColorStop(0, node.getData<string>("color"));
  context.fillStyle = gradient;
  renderSunburstPieNode(type, node, canvas, animating, config);
}

export function containsSunburstGradientPieNode(
  node: SunburstRenderableNode,
  position: RenderPoint,
  config?: SunburstRendererConfig,
): boolean {
  return containsSunburstPieNode(node, position, config);
}
