export type InputEventKind =
  | "MouseUp"
  | "MouseDown"
  | "MouseMove"
  | "MouseOver"
  | "MouseOut"
  | "MouseWheel"
  | "TouchStart"
  | "TouchMove"
  | "TouchEnd"
  | "TouchCancel"
  | "ContextMenu";

export type InputEventListener<TEvent> = (event: TEvent) => void;

/** Small structural surface implemented by browser event targets and fakes. */
export interface InputEventTarget<TEvent, TListenerOptions = unknown> {
  addEventListener(
    type: string,
    listener: InputEventListener<TEvent>,
    options?: TListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: InputEventListener<TEvent>,
    options?: TListenerOptions,
  ): void;
}

/**
 * Receivers deliberately use the legacy argument order. This makes small
 * adapters sufficient for Events, Navigation, NodeStyles, and Tips while the
 * manager remains independent from those optional features.
 */
export interface InputEventReceiver<TEvent, TEnvironment, TEventInfo> {
  onMouseUp?(
    event: TEvent,
    environment: TEnvironment | undefined,
    info: TEventInfo,
    isRightClick: boolean,
  ): void;
  onMouseDown?(
    event: TEvent,
    environment: TEnvironment | undefined,
    info: TEventInfo,
    isRightClick: boolean,
  ): void;
  onMouseMove?(
    event: TEvent,
    environment: TEnvironment | undefined,
    info: TEventInfo,
  ): void;
  onMouseOver?(
    event: TEvent,
    environment: TEnvironment | undefined,
    info: TEventInfo,
  ): void;
  onMouseOut?(
    event: TEvent,
    environment: TEnvironment | undefined,
    info: TEventInfo,
  ): void;
  onMouseWheel?(
    event: TEvent,
    environment: TEnvironment | undefined,
    delta: number,
  ): void;
  onTouchStart?(
    event: TEvent,
    environment: TEnvironment | undefined,
    info: TEventInfo,
  ): void;
  onTouchMove?(
    event: TEvent,
    environment: TEnvironment | undefined,
    info: TEventInfo,
  ): void;
  onTouchEnd?(
    event: TEvent,
    environment: TEnvironment | undefined,
    info: TEventInfo,
  ): void;
  onTouchCancel?(
    event: TEvent,
    environment: TEnvironment | undefined,
    info: TEventInfo,
  ): void;
  onContextMenu?(
    event: TEvent,
    environment: TEnvironment | undefined,
    info: TEventInfo,
  ): void;
}

export interface InputManagerDependencies<
  TEvent,
  TEnvironment,
  TEventInfo,
  TListenerOptions = unknown,
> {
  readonly target: InputEventTarget<TEvent, TListenerOptions>;
  readonly environment?: TEnvironment;
  readonly getEnvironment?: (
    event: TEvent,
  ) => TEnvironment | undefined;
  readonly makeEventInfo: (
    event: TEvent,
    environment: TEnvironment | undefined,
  ) => TEventInfo;
  readonly isRightClick: (
    event: TEvent,
    environment: TEnvironment | undefined,
  ) => boolean;
  readonly getWheelDelta: (
    event: TEvent,
    environment: TEnvironment | undefined,
  ) => number;
  readonly cancelContextMenu?: false | ((
    event: TEvent,
    environment: TEnvironment | undefined,
  ) => void);
  readonly listenerOptions?: TListenerOptions;
  readonly getListenerOptions?: (
    eventName: string,
  ) => TListenerOptions | undefined;
}

export interface InputManagerOptions {
  /** Use `mousewheel` or `DOMMouseScroll` for a legacy host. */
  readonly wheelEvent?: string;
}

interface ListenerBinding<TEvent, TListenerOptions> {
  readonly eventName: string;
  readonly listener: InputEventListener<TEvent>;
  listenerOptions: TListenerOptions | undefined;
}

interface RegisteredReceiver<TEvent, TEnvironment, TEventInfo> {
  readonly receiver: InputEventReceiver<TEvent, TEnvironment, TEventInfo>;
  active: boolean;
}

function cancelContextMenuByDefault(event: unknown): void {
  if (
    (typeof event !== "object" || event === null) &&
    typeof event !== "function"
  ) {
    return;
  }

  const cancelable = event as {
    preventDefault?: () => void;
    returnValue?: boolean;
  };
  cancelable.preventDefault?.call(event);
  cancelable.returnValue = false;
}

/**
 * Attaches the browser-facing event layer without consulting ambient state.
 * Importing or constructing the manager does not attach anything; `attach`
 * and `detach` make the lifecycle explicit and symmetric.
 */
export class InputManager<
  TEvent,
  TEnvironment = unknown,
  TEventInfo = unknown,
  TListenerOptions = unknown,
> {
  readonly dependencies: InputManagerDependencies<
    TEvent,
    TEnvironment,
    TEventInfo,
    TListenerOptions
  >;

  private readonly bindings: readonly ListenerBinding<
    TEvent,
    TListenerOptions
  >[];
  private readonly receivers: RegisteredReceiver<
    TEvent,
    TEnvironment,
    TEventInfo
  >[] = [];
  private attachedState = false;

  constructor(
    dependencies: InputManagerDependencies<
      TEvent,
      TEnvironment,
      TEventInfo,
      TListenerOptions
    >,
    options: InputManagerOptions = {},
  ) {
    this.dependencies = dependencies;
    const wheelEvent = options.wheelEvent ?? "wheel";
    this.bindings = [
      this.binding("mouseup", "MouseUp"),
      this.binding("mousedown", "MouseDown"),
      this.binding("mousemove", "MouseMove"),
      this.binding("mouseover", "MouseOver"),
      this.binding("mouseout", "MouseOut"),
      this.binding("touchstart", "TouchStart"),
      this.binding("touchmove", "TouchMove"),
      this.binding("touchend", "TouchEnd"),
      this.binding("touchcancel", "TouchCancel"),
      this.binding(wheelEvent, "MouseWheel"),
      this.binding("contextmenu", "ContextMenu"),
    ];
  }

  get attached(): boolean {
    return this.attachedState;
  }

  get size(): number {
    let count = 0;
    for (const registration of this.receivers) {
      if (registration.active) count++;
    }
    return count;
  }

  /** Idempotently install every listener. */
  attach(): this {
    if (this.attachedState) return this;

    const { target } = this.dependencies;
    for (const binding of this.bindings) {
      const listenerOptions = this.getListenerOptions(binding.eventName);
      binding.listenerOptions = listenerOptions;
      target.addEventListener(
        binding.eventName,
        binding.listener,
        listenerOptions,
      );
    }
    this.attachedState = true;
    return this;
  }

  /** Idempotently remove the exact listener functions installed by attach. */
  detach(): this {
    if (!this.attachedState) return this;

    const { target } = this.dependencies;
    for (const binding of this.bindings) {
      target.removeEventListener(
        binding.eventName,
        binding.listener,
        binding.listenerOptions,
      );
    }
    this.attachedState = false;
    return this;
  }

  /** Register one feature and return an idempotent unregistration callback. */
  register(
    receiver: InputEventReceiver<TEvent, TEnvironment, TEventInfo>,
  ): () => void {
    const registration = { receiver, active: true };
    this.receivers.push(registration);

    return () => {
      if (!registration.active) return;
      registration.active = false;
      const index = this.receivers.indexOf(registration);
      if (index >= 0) this.receivers.splice(index, 1);
    };
  }

  /** Remove all registrations of a receiver, including duplicates. */
  unregister(
    receiver: InputEventReceiver<TEvent, TEnvironment, TEventInfo>,
  ): boolean {
    let removed = false;
    for (let index = this.receivers.length - 1; index >= 0; index--) {
      const registration = this.receivers[index];
      if (registration?.receiver !== receiver) continue;
      registration.active = false;
      this.receivers.splice(index, 1);
      removed = true;
    }
    return removed;
  }

  /** Route one already-normalized event through the registered features. */
  dispatch(kind: InputEventKind, event: TEvent): void {
    const environment = this.resolveEnvironment(event);

    if (kind === "MouseWheel") {
      const delta = this.dependencies.getWheelDelta(event, environment);
      this.eachReceiver((receiver) => {
        receiver.onMouseWheel?.(event, environment, delta);
      });
      return;
    }

    if (kind === "ContextMenu") {
      const cancel = this.dependencies.cancelContextMenu;
      if (cancel !== false) {
        if (cancel) cancel(event, environment);
        else cancelContextMenuByDefault(event);
      }
    }

    const info = this.dependencies.makeEventInfo(event, environment);
    switch (kind) {
      case "MouseUp": {
        const right = this.dependencies.isRightClick(event, environment);
        this.eachReceiver((receiver) => {
          receiver.onMouseUp?.(event, environment, info, right);
        });
        break;
      }
      case "MouseDown": {
        const right = this.dependencies.isRightClick(event, environment);
        this.eachReceiver((receiver) => {
          receiver.onMouseDown?.(event, environment, info, right);
        });
        break;
      }
      case "MouseMove":
        this.eachReceiver((receiver) => {
          receiver.onMouseMove?.(event, environment, info);
        });
        break;
      case "MouseOver":
        this.eachReceiver((receiver) => {
          receiver.onMouseOver?.(event, environment, info);
        });
        break;
      case "MouseOut":
        this.eachReceiver((receiver) => {
          receiver.onMouseOut?.(event, environment, info);
        });
        break;
      case "TouchStart":
        this.eachReceiver((receiver) => {
          receiver.onTouchStart?.(event, environment, info);
        });
        break;
      case "TouchMove":
        this.eachReceiver((receiver) => {
          receiver.onTouchMove?.(event, environment, info);
        });
        break;
      case "TouchEnd":
        this.eachReceiver((receiver) => {
          receiver.onTouchEnd?.(event, environment, info);
        });
        break;
      case "TouchCancel":
        this.eachReceiver((receiver) => {
          receiver.onTouchCancel?.(event, environment, info);
        });
        break;
      case "ContextMenu":
        this.eachReceiver((receiver) => {
          receiver.onContextMenu?.(event, environment, info);
        });
        break;
    }
  }

  private binding(
    eventName: string,
    kind: InputEventKind,
  ): ListenerBinding<TEvent, TListenerOptions> {
    return {
      eventName,
      listener: (event) => this.dispatch(kind, event),
      listenerOptions: undefined,
    };
  }

  private resolveEnvironment(event: TEvent): TEnvironment | undefined {
    return this.dependencies.getEnvironment
      ? this.dependencies.getEnvironment(event)
      : this.dependencies.environment;
  }

  private getListenerOptions(eventName: string): TListenerOptions | undefined {
    return this.dependencies.getListenerOptions
      ? this.dependencies.getListenerOptions(eventName)
      : this.dependencies.listenerOptions;
  }

  private eachReceiver(
    visit: (
      receiver: InputEventReceiver<TEvent, TEnvironment, TEventInfo>,
    ) => void,
  ): void {
    const snapshot = this.receivers.slice();
    for (const registration of snapshot) {
      if (registration.active) visit(registration.receiver);
    }
  }
}
