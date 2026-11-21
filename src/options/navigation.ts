export interface NavigationOptions {
  enable: boolean;
  type: "auto" | "Native" | "HTML" | "SVG";
  panning: boolean | "avoid nodes";
  zooming: boolean | number;
}

export function createNavigationOptions(): NavigationOptions {
  return {
    enable: false,
    type: "auto",
    panning: false,
    zooming: false,
  };
}
