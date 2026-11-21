export interface EdgeOptions {
  overridable: boolean;
  type: string;
  color: string;
  lineWidth: number;
  dim: number;
  alpha: number;
  epsilon: number;
  CanvasStyles: Record<string, unknown>;
}

export function createEdgeOptions(): EdgeOptions {
  return {
    overridable: false,
    type: "line",
    color: "#ccb",
    lineWidth: 1,
    dim: 15,
    alpha: 1,
    epsilon: 7,
    CanvasStyles: {},
  };
}
