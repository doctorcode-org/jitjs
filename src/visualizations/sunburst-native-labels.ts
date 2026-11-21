import { NativeLabels } from "../graph/labels/native.js";
import type {
  SunburstLabelCanvas,
  SunburstLabelNode,
  SunburstLabelState,
  SunburstNativeLabelController,
} from "./sunburst-label-contracts.js";

/** Render the visualization-specific portion of a native Sunburst label. */
export function renderSunburstNativeLabel<
  TNode extends SunburstLabelNode,
  TController extends SunburstNativeLabelController,
>(
  canvas: SunburstLabelCanvas,
  node: TNode,
  controller: TController,
  state: SunburstLabelState,
): void {
  const span = node.getData<number>("span");
  if (
    span < Math.PI / 2 &&
    Math.tan(span) * state.config.levelDistance * node._depth < 10
  ) {
    return;
  }

  const context = canvas.getCtx();
  const measurement = context.measureText(node.name);
  let x: number;
  let y: number;
  let labelAngle: number;

  if (node.id == state.root) {
    x = -measurement.width / 2;
    y = 0;
    labelAngle = 0;
  } else {
    const indent = 5;
    // This value was unused by JIT 2.0.1, but the property access is
    // observable for proxy-backed configuration objects.
    controller.levelDistance - indent;
    const position = node.pos.clone();
    position.rho += indent;
    const polar = position.getp(true);
    const cartesian = position.getc(true);
    x = cartesian.x;
    y = cartesian.y;

    const pi = Math.PI;
    const pointsLeft = polar.theta > pi / 2 && polar.theta < (3 * pi) / 2;
    labelAngle = pointsLeft ? polar.theta + pi : polar.theta;
    if (pointsLeft) {
      x -= Math.abs(Math.cos(polar.theta) * measurement.width);
      y += Math.sin(polar.theta) * measurement.width;
    }
  }

  context.save();
  context.translate(x, y);
  context.rotate(labelAngle);
  context.fillText(node.name, 0, 0);
  context.restore();
}

/** Sunburst's Canvas label backend with all visualization state explicit. */
export class SunburstNativeLabels<
  TNode extends SunburstLabelNode = SunburstLabelNode,
  TController extends SunburstNativeLabelController = SunburstNativeLabelController,
> extends NativeLabels<TNode, TController> {
  private readonly state: SunburstLabelState;

  constructor(state: SunburstLabelState) {
    super((canvas, node, controller) => {
      renderSunburstNativeLabel(canvas, node, controller, state);
    });
    this.state = state;
  }

  override plotLabel(
    canvas: SunburstLabelCanvas,
    node: TNode,
    controller: TController,
  ): void {
    const context = canvas.getCtx();

    // Graph.Label.Native performs this otherwise-unused access before styling.
    node.pos.getc(true);
    context.font = `${node.getLabelData<string>("style")} ${node.getLabelData<number>("size")}px ${node.getLabelData<string>("family")}`;
    context.textAlign = node.getLabelData<CanvasTextAlign>("textAlign");
    context.fillStyle = context.strokeStyle =
      node.getLabelData<string>("color");
    context.textBaseline =
      node.getLabelData<CanvasTextBaseline>("textBaseline");

    renderSunburstNativeLabel(canvas, node, controller, this.state);
  }
}
