export interface CanvasLightingOptions {
  enable: boolean;
  ambient: [number, number, number];
  directional: {
    direction: { x: number; y: number; z: number };
    color: [number, number, number];
  };
}

export interface CanvasOptions {
  injectInto: string | HTMLElement;
  type: "2D" | "3D";
  width: number | false;
  height: number | false;
  useCanvas: unknown | false;
  withLabels: boolean;
  background: unknown | false;
  Scene: { Lighting: CanvasLightingOptions };
}

export function createCanvasOptions(): CanvasOptions {
  return {
    injectInto: "id",
    type: "2D",
    width: false,
    height: false,
    useCanvas: false,
    withLabels: true,
    background: false,
    Scene: {
      Lighting: {
        enable: false,
        ambient: [1, 1, 1],
        directional: {
          direction: { x: -100, y: -100, z: -100 },
          color: [0.5, 0.3, 0.1],
        },
      },
    },
  };
}
