import { empty } from "../core/util.js";

export type EventCallback = (...arguments_: unknown[]) => void;

export interface EventsOptions {
  enable: boolean;
  enableForEdges: boolean;
  type: "auto" | "Native" | "HTML" | "SVG";
  onClick: EventCallback;
  onRightClick: EventCallback;
  onMouseMove: EventCallback;
  onMouseEnter: EventCallback;
  onMouseLeave: EventCallback;
  onDragStart: EventCallback;
  onDragMove: EventCallback;
  onDragCancel: EventCallback;
  onDragEnd: EventCallback;
  onTouchStart: EventCallback;
  onTouchMove: EventCallback;
  onTouchEnd: EventCallback;
  onMouseWheel: EventCallback;
}

export function createEventsOptions(): EventsOptions {
  return {
    enable: false,
    enableForEdges: false,
    type: "auto",
    onClick: empty,
    onRightClick: empty,
    onMouseMove: empty,
    onMouseEnter: empty,
    onMouseLeave: empty,
    onDragStart: empty,
    onDragMove: empty,
    onDragCancel: empty,
    onDragEnd: empty,
    onTouchStart: empty,
    onTouchMove: empty,
    onTouchEnd: empty,
    onMouseWheel: empty,
  };
}
