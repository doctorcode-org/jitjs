export interface NavigationPoint {
  x: number;
  y: number;
}

export interface NavigationCanvas {
  translateOffsetX: number;
  translateOffsetY: number;
  scaleOffsetX: number;
  scaleOffsetY: number;
  scale(x: number, y: number): void;
  translate(x: number, y: number): void;
}

export interface NavigationEventInfo<TNode = unknown> {
  getPos(): NavigationPoint;
  getNode(): TNode | null | false | undefined;
}

export interface NavigationConfig {
  panning: boolean | "avoid nodes";
  zooming: boolean | number;
}

export interface NavigationDependencies<TEvent = unknown, TEnvironment = unknown> {
  canvas: NavigationCanvas;

  /**
   * Normalize and stop the supplied event. This replaces the legacy global
   * event utility and is called only for an enabled wheel interaction.
   */
  stopEvent(event: TEvent, environment: TEnvironment): void;

  /**
   * Supplying this adapter selects the legacy DOM-label hit-test branch.
   * Omitting it selects native node hit testing through eventInfo.getNode().
   */
  isLabel?: (event: TEvent, environment: TEnvironment) => unknown;
}

/**
 * Standalone panning and zooming behavior equivalent to
 * Extras.Classes.Navigation. Canvas operations and event handling are
 * structural dependencies, so importing this module never touches the DOM or
 * installs a global registry.
 */
export class NavigationController<
  TEvent = unknown,
  TEnvironment = unknown,
  TNode = unknown,
> {
  pressed = false;
  pos: NavigationPoint | false = false;

  private readonly canvas: NavigationCanvas;

  constructor(
    readonly config: NavigationConfig,
    private readonly dependencies: NavigationDependencies<
      TEvent,
      TEnvironment
    >,
  ) {
    this.canvas = dependencies.canvas;
  }

  onMouseWheel(
    event: TEvent,
    environment: TEnvironment,
    scroll: number,
  ): void {
    if (!this.config.zooming) return;

    this.dependencies.stopEvent(event, environment);
    const amount = Number(this.config.zooming) / 1000;
    const scale = 1 + scroll * amount;
    this.canvas.scale(scale, scale);
  }

  onMouseDown(
    event: TEvent,
    environment: TEnvironment,
    eventInfo: NavigationEventInfo<TNode>,
  ): void {
    if (!this.config.panning) return;
    if (this.shouldAvoid(event, environment, eventInfo)) return;

    this.pressed = true;
    const position = eventInfo.getPos();
    this.projectPosition(position);
    this.pos = position;
  }

  onMouseMove(
    event: TEvent,
    environment: TEnvironment,
    eventInfo: NavigationEventInfo<TNode>,
  ): void {
    if (!this.config.panning || !this.pressed) return;
    if (this.shouldAvoid(event, environment, eventInfo)) return;

    const previous = this.pos;
    if (previous === false) return;

    const current = eventInfo.getPos();
    this.projectPosition(current);

    const x = current.x - previous.x;
    const y = current.y - previous.y;
    this.pos = current;
    this.canvas.translate(
      (x * 1) / this.canvas.scaleOffsetX,
      (y * 1) / this.canvas.scaleOffsetY,
    );
  }

  onMouseUp(
    _event: TEvent,
    _environment: TEnvironment,
    _eventInfo: NavigationEventInfo<TNode>,
    _isRightClick?: boolean,
  ): void {
    if (!this.config.panning) return;
    this.pressed = false;
  }

  private shouldAvoid(
    event: TEvent,
    environment: TEnvironment,
    eventInfo: NavigationEventInfo<TNode>,
  ): boolean {
    if (this.config.panning !== "avoid nodes") return false;

    const { isLabel } = this.dependencies;
    return Boolean(
      isLabel
        ? isLabel(event, environment)
        : eventInfo.getNode(),
    );
  }

  private projectPosition(position: NavigationPoint): void {
    position.x *= this.canvas.scaleOffsetX;
    position.x += this.canvas.translateOffsetX;
    position.y *= this.canvas.scaleOffsetY;
    position.y += this.canvas.translateOffsetY;
  }
}
