export type NodeStyleMap = Record<string, unknown>;

export interface NodeStylesOptions {
  enable: boolean;
  type: "auto" | "Native" | "HTML" | "SVG";
  stylesHover: false | NodeStyleMap;
  stylesClick: false | NodeStyleMap;
}

export function createNodeStylesOptions(): NodeStylesOptions {
  return {
    enable: false,
    type: "auto",
    stylesHover: false,
    stylesClick: false,
  };
}
