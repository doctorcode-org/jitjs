import type { LabelType } from "../types.js";

export interface LabelOptions {
  overridable: boolean;
  type: LabelType;
  style: string;
  size: number;
  family: string;
  textAlign: string;
  textBaseline: string;
  color: string;
}

export function createLabelOptions(): LabelOptions {
  return {
    overridable: false,
    type: "HTML",
    style: " ",
    size: 10,
    family: "sans-serif",
    textAlign: "center",
    textBaseline: "alphabetic",
    color: "#fff",
  };
}
