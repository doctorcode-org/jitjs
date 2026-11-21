export interface TooltipPoint {
  readonly x: number;
  readonly y: number;
}

export interface TooltipDimensions {
  readonly width: number;
  readonly height: number;
}

export type TooltipViewport = TooltipDimensions;

export interface TooltipOffsets {
  readonly offsetX: number;
  readonly offsetY: number;
}

/** Minimal mutable style surface used by the tooltip kernel. */
export interface TooltipStyle {
  display: string;
  top: string;
  left: string;
}

/** An HTMLElement satisfies this contract without a runtime DOM dependency. */
export interface TooltipElementLike<TStyle extends TooltipStyle = TooltipStyle> {
  readonly style: TStyle;
  readonly offsetWidth: number;
  readonly offsetHeight: number;
}

export interface TooltipPosition {
  readonly top: number;
  readonly left: number;
}

export interface TooltipCallbacks<
  TTooltip extends TooltipElementLike,
  TNode,
  TContains,
> extends TooltipOffsets {
  onShow(tooltip: TTooltip, node: TNode, contains: TContains): void;
  onHide(): void;
}

/** Pure legacy positioning calculation; deliberately does not clamp negatives. */
export function computeTooltipPosition(
  pointer: TooltipPoint,
  viewport: TooltipViewport,
  tooltip: TooltipDimensions,
  offsets: TooltipOffsets,
): TooltipPosition {
  const top =
    pointer.y + offsets.offsetY + tooltip.height > viewport.height
      ? pointer.y - tooltip.height - offsets.offsetY
      : pointer.y + offsets.offsetY;
  const left =
    pointer.x + tooltip.width + offsets.offsetX > viewport.width
      ? pointer.x - tooltip.width - offsets.offsetX
      : pointer.x + offsets.offsetX;
  return { top, left };
}

/**
 * Renderer- and document-independent tooltip visibility kernel.
 *
 * The element is made visible before its dimensions are read, matching JIT
 * 2.0.1 and allowing browser layout to report the displayed tooltip size.
 */
export class TooltipController<
  TTooltip extends TooltipElementLike,
  TNode = unknown,
  TContains = unknown,
> {
  readonly tooltip: TTooltip;
  readonly options: Readonly<
    TooltipCallbacks<TTooltip, TNode, TContains>
  >;

  constructor(
    tooltip: TTooltip,
    options: TooltipCallbacks<TTooltip, TNode, TContains>,
  ) {
    this.tooltip = tooltip;
    this.options = options;
  }

  setTooltipPosition(
    pointer: TooltipPoint,
    viewport: TooltipViewport,
  ): TooltipPosition {
    const style = this.tooltip.style;
    style.display = "";

    const dimensions = {
      width: this.tooltip.offsetWidth,
      height: this.tooltip.offsetHeight,
    };
    const position = computeTooltipPosition(
      pointer,
      viewport,
      dimensions,
      this.options,
    );
    style.top = `${position.top}px`;
    style.left = `${position.left}px`;
    return position;
  }

  /** Native-tooltip ordering: populate first, then reveal, measure, and place. */
  show(
    node: TNode,
    contains: TContains,
    pointer: TooltipPoint,
    viewport: TooltipViewport,
  ): TooltipPosition {
    this.options.onShow(this.tooltip, node, contains);
    return this.setTooltipPosition(pointer, viewport);
  }

  /** Hide first so `onHide` observes the final visibility state. */
  hide(triggerCallback: boolean): void {
    this.tooltip.style.display = "none";
    if (triggerCallback) {
      this.options.onHide();
    }
  }
}
