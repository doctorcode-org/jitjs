export interface Position {
  x: number;
  y: number;
}

export type CleanableNode = Node & {
  clearAttributes?: () => void;
};

export type DomEventHandler<TEvent extends Event = Event> = (
  event: TEvent,
) => void;

export interface LegacyEventTarget<TEvent extends Event = Event> {
  attachEvent(type: string, handler: DomEventHandler<TEvent>): void;
}

export interface ClassNameTarget {
  className: string;
}

export interface WheelEventLike {
  wheelDelta?: number;
  detail?: number;
}

export interface RightClickEventLike {
  which?: number | string;
  button?: number | string;
}

export interface PointerCoordinates {
  pageX?: number;
  pageY?: number;
  clientX?: number;
  clientY?: number;
}

export interface PointerEventLike extends PointerCoordinates {
  touches?: ArrayLike<PointerCoordinates>;
}

export interface ScrollContainer {
  scrollLeft: number;
  scrollTop: number;
}

export interface EventWindow<TEvent = Event> {
  event?: TEvent;
  document: {
    documentElement?: ScrollContainer | null;
    body?: ScrollContainer | null;
  };
}

export interface StoppableEventLike {
  stopPropagation?: () => void;
  preventDefault?: () => void;
  cancelBubble?: boolean;
  returnValue?: boolean;
}

/** Resolve an element by id. The ambient document is read only when called. */
export function id<TElement extends HTMLElement = HTMLElement>(
  identifier: string,
  ownerDocument: Pick<Document, "getElementById"> = document,
): TElement | null {
  return ownerDocument.getElementById(identifier) as TElement | null;
}

/** Recursively clean a node, detach it, and invoke old-IE cleanup when present. */
export function destroy(element: CleanableNode): void {
  clean(element);
  if (element.parentNode) {
    element.parentNode.removeChild(element);
  }
  if (element.clearAttributes) {
    element.clearAttributes();
  }
}

/**
 * Recursively destroy child nodes.
 *
 * Iteration intentionally follows JIT 2.0.1, including its interaction with a
 * live `childNodes` collection.
 */
export function clean(element: Node): void {
  const children = element.childNodes;
  for (let index = 0, length = children.length; index < length; index += 1) {
    destroy(children[index] as CleanableNode);
  }
}

/** Register an event through the standard API or the legacy attachEvent path. */
export function addEvent<TEvent extends Event = Event>(
  target: EventTarget | LegacyEventTarget<TEvent>,
  type: string,
  handler: DomEventHandler<TEvent>,
): void {
  const modernTarget = target as EventTarget;
  if (modernTarget.addEventListener) {
    modernTarget.addEventListener(type, handler as EventListener, false);
  } else {
    (target as LegacyEventTarget<TEvent>).attachEvent(`on${type}`, handler);
  }
}

/** Register a map of event handlers, retaining legacy enumerable-key behavior. */
export function addEvents<TEvent extends Event = Event>(
  target: EventTarget | LegacyEventTarget<TEvent>,
  handlers: Readonly<Record<string, DomEventHandler<TEvent>>>,
): void {
  for (const type in handlers) {
    addEvent(target, type, handlers[type] as DomEventHandler<TEvent>);
  }
}

export function hasClass(target: ClassNameTarget, className: string): boolean {
  return (` ${target.className} `).indexOf(` ${className} `) > -1;
}

export function addClass(target: ClassNameTarget, className: string): void {
  if (!hasClass(target, className)) {
    target.className = `${target.className} ${className}`;
  }
}

export function removeClass(target: ClassNameTarget, className: string): void {
  target.className = target.className.replace(
    new RegExp(`(^|\\s)${className}(?:\\s|$)`),
    "$1",
  );
}

/** Return an element's document-relative offset minus ancestor scrolling. */
export function getPos(element: HTMLElement): Position {
  const offset = getOffsets(element);
  const scroll = getScrolls(element);
  return {
    x: offset.x - scroll.x,
    y: offset.y - scroll.y,
  };
}

function getOffsets(element: HTMLElement): Position {
  const position: Position = { x: 0, y: 0 };
  let current: HTMLElement | null = element;
  while (current && !isBody(current)) {
    position.x += current.offsetLeft;
    position.y += current.offsetTop;
    current = current.offsetParent as HTMLElement | null;
  }
  return position;
}

function getScrolls(element: HTMLElement): Position {
  const position: Position = { x: 0, y: 0 };
  let current: HTMLElement | null = element;
  while (current && !isBody(current)) {
    position.x += current.scrollLeft;
    position.y += current.scrollTop;
    current = current.parentNode as HTMLElement | null;
  }
  return position;
}

function isBody(element: Pick<Element, "tagName">): boolean {
  return /^(?:body|html)$/i.test(element.tagName);
}

function resolveEventWindow<TEvent>(
  targetWindow?: EventWindow<TEvent>,
): EventWindow<TEvent> {
  return targetWindow || (window as unknown as EventWindow<TEvent>);
}

export function getEvent<TEvent = Event>(
  suppliedEvent?: TEvent | null,
  targetWindow?: EventWindow<TEvent>,
): TEvent | undefined {
  const resolvedWindow = resolveEventWindow(targetWindow);
  return suppliedEvent || resolvedWindow.event;
}

export function getWheel(event: WheelEventLike): number {
  return event.wheelDelta
    ? event.wheelDelta / 120
    : -(event.detail || 0) / 3;
}

export function isRightClick(event: RightClickEventLike): boolean {
  return event.which == 3 || event.button == 2;
}

export function getEventPosition(
  suppliedEvent?: PointerEventLike | null,
  targetWindow?: EventWindow<PointerEventLike>,
): Position {
  const resolvedWindow = resolveEventWindow(targetWindow);
  let currentEvent = (suppliedEvent || resolvedWindow.event)!;
  const ownerDocument = resolvedWindow.document;
  const scrollContainer = (ownerDocument.documentElement ||
    ownerDocument.body)!;

  if (currentEvent.touches && currentEvent.touches.length) {
    currentEvent = currentEvent.touches[0] as PointerEventLike;
  }

  return {
    x: currentEvent.pageX || currentEvent.clientX! + scrollContainer.scrollLeft,
    y: currentEvent.pageY || currentEvent.clientY! + scrollContainer.scrollTop,
  };
}

export function stopEvent(event: StoppableEventLike): void {
  if (event.stopPropagation) {
    event.stopPropagation();
  }
  event.cancelBubble = true;
  if (event.preventDefault) {
    event.preventDefault();
  } else {
    event.returnValue = false;
  }
}

/** Namespace-style event access; direct imports remain the tree-shaking path. */
export const event = {
  get: getEvent,
  getWheel,
  isRightClick,
  getPos: getEventPosition,
  stop: stopEvent,
};
