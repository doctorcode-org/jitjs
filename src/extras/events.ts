export interface InteractionEventInfo<TTarget> {
  getNode(): TTarget | false;
  getEdge(): TTarget | false;
}

export interface InteractionEventCallbacks<TTarget, TEventInfo, TRawEvent> {
  enableForEdges: boolean;
  onClick(target: TTarget | false, info: TEventInfo, event: TRawEvent): void;
  onRightClick(
    target: TTarget | false,
    info: TEventInfo,
    event: TRawEvent,
  ): void;
  onMouseMove(
    target: TTarget | false,
    info: TEventInfo,
    event: TRawEvent,
  ): void;
  onMouseEnter(target: TTarget, info: TEventInfo, event: TRawEvent): void;
  onMouseLeave(target: TTarget, info: TEventInfo, event: TRawEvent): void;
  onDragStart(target: TTarget, info: TEventInfo, event: TRawEvent): void;
  onDragMove(target: TTarget, info: TEventInfo, event: TRawEvent): void;
  onDragCancel(target: TTarget, info: TEventInfo, event: TRawEvent): void;
  onDragEnd(target: TTarget, info: TEventInfo, event: TRawEvent): void;
  onTouchStart(target: TTarget, info: TEventInfo, event: TRawEvent): void;
  onTouchMove(target: TTarget, info: TEventInfo, event: TRawEvent): void;
  onTouchEnd(target: TTarget, info: TEventInfo, event: TRawEvent): void;
  onTouchCancel(target: TTarget, info: TEventInfo, event: TRawEvent): void;
  onMouseWheel(delta: number, event: TRawEvent): void;
}

export interface InteractionEventDependencies<
  TTarget,
  TEventInfo extends InteractionEventInfo<TTarget>,
> {
  /** Recheck whether the current native-canvas target is still under pointer. */
  contains(target: TTarget, info: TEventInfo): unknown;
}

/**
 * Renderer-independent state machine for legacy Events callbacks. Browser
 * event normalization, label lookup, and hit testing stay in adapters.
 */
export class InteractionEventsController<
  TTarget,
  TEventInfo extends InteractionEventInfo<TTarget>,
  TRawEvent = unknown,
> {
  readonly callbacks: InteractionEventCallbacks<TTarget, TEventInfo, TRawEvent>;
  readonly dependencies: InteractionEventDependencies<TTarget, TEventInfo>;
  readonly dom: boolean;
  hovered: TTarget | false = false;
  pressed: TTarget | false = false;
  touched: TTarget | false = false;
  moved = false;
  touchMoved = false;

  constructor(
    callbacks: InteractionEventCallbacks<TTarget, TEventInfo, TRawEvent>,
    dependencies: InteractionEventDependencies<TTarget, TEventInfo>,
    options: { dom?: boolean } = {},
  ) {
    this.callbacks = callbacks;
    this.dependencies = dependencies;
    this.dom = options.dom ?? false;
  }

  onMouseUp(
    info: TEventInfo,
    event: TRawEvent,
    isRightClick = false,
  ): void {
    if (!this.moved) {
      if (isRightClick) {
        this.callbacks.onRightClick(this.hovered, info, event);
      } else {
        this.callbacks.onClick(this.pressed, info, event);
      }
    }

    if (this.pressed) {
      if (this.moved) {
        this.callbacks.onDragEnd(this.pressed, info, event);
      } else {
        this.callbacks.onDragCancel(this.pressed, info, event);
      }
      this.pressed = false;
      this.moved = false;
    }
  }

  onMouseDown(info: TEventInfo, event: TRawEvent, target?: TTarget | false): void {
    this.pressed = target === undefined ? this.resolveTarget(info) : target;
    if (this.pressed) {
      this.callbacks.onDragStart(this.pressed, info, event);
    }
  }

  onMouseMove(info: TEventInfo, event: TRawEvent): void {
    if (this.pressed) {
      this.moved = true;
      this.callbacks.onDragMove(this.pressed, info, event);
      return;
    }

    if (this.dom) {
      this.callbacks.onMouseMove(this.hovered, info, event);
      return;
    }

    if (this.hovered) {
      const hovered = this.hovered;
      if (this.dependencies.contains(hovered, info)) {
        this.callbacks.onMouseMove(hovered, info, event);
        return;
      }
      this.callbacks.onMouseLeave(hovered, info, event);
      this.hovered = false;
    }

    const target = this.resolveTarget(info);
    if (target) {
      this.hovered = target;
      this.callbacks.onMouseEnter(target, info, event);
    } else {
      this.callbacks.onMouseMove(false, info, event);
    }
  }

  onMouseEnter(target: TTarget, info: TEventInfo, event: TRawEvent): void {
    this.hovered = target;
    this.callbacks.onMouseEnter(target, info, event);
  }

  onMouseLeave(info: TEventInfo, event: TRawEvent): void {
    if (this.hovered) {
      this.callbacks.onMouseLeave(this.hovered, info, event);
      this.hovered = false;
    }
  }

  onMouseWheel(delta: number, event: TRawEvent): void {
    this.callbacks.onMouseWheel(delta, event);
  }

  onTouchStart(
    info: TEventInfo,
    event: TRawEvent,
    target?: TTarget | false,
  ): void {
    this.touched = target === undefined ? this.resolveTarget(info) : target;
    if (this.touched) {
      this.callbacks.onTouchStart(this.touched, info, event);
    }
  }

  onTouchMove(info: TEventInfo, event: TRawEvent): void {
    if (this.touched) {
      this.touchMoved = true;
      this.callbacks.onTouchMove(this.touched, info, event);
    }
  }

  onTouchEnd(info: TEventInfo, event: TRawEvent): void {
    if (!this.touched) {
      return;
    }
    if (this.touchMoved) {
      this.callbacks.onTouchEnd(this.touched, info, event);
    } else {
      this.callbacks.onTouchCancel(this.touched, info, event);
    }
    this.touched = false;
    this.touchMoved = false;
  }

  private resolveTarget(info: TEventInfo): TTarget | false {
    return info.getNode() ||
      (this.callbacks.enableForEdges && info.getEdge()) ||
      false;
  }
}
