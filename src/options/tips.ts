import { empty } from "../core/util.js";

export type TipCallback = (...arguments_: unknown[]) => void;

export interface TipsOptions {
  enable: boolean;
  type: "auto" | "Native" | "HTML" | "SVG";
  offsetX: number;
  offsetY: number;
  force: boolean;
  onShow: TipCallback;
  onHide: TipCallback;
}

export function createTipsOptions(): TipsOptions {
  return {
    enable: false,
    type: "auto",
    offsetX: 20,
    offsetY: 20,
    force: false,
    onShow: empty,
    onHide: empty,
  };
}
