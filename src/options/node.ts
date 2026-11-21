export interface NodeOptions {
  overridable: boolean;
  type: string;
  color: string;
  alpha: number;
  dim: number;
  height: number;
  width: number;
  autoHeight: boolean;
  autoWidth: boolean;
  lineWidth: number;
  transform: boolean;
  align: "left" | "center" | "right";
  angularWidth: number;
  span: number;
  CanvasStyles: Record<string, unknown>;
}

export function createNodeOptions(): NodeOptions {
  return {
    overridable: false,
    type: "circle",
    color: "#ccb",
    alpha: 1,
    dim: 3,
    height: 20,
    width: 90,
    autoHeight: false,
    autoWidth: false,
    lineWidth: 1,
    transform: true,
    align: "center",
    angularWidth: 1,
    span: 1,
    CanvasStyles: {},
  };
}
