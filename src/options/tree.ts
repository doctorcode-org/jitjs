export interface TreeOptions {
  orientation: "left" | "top" | "right" | "bottom";
  subtreeOffset: number;
  siblingOffset: number;
  indent: number;
  multitree: boolean;
  align: "left" | "center" | "right";
}

export function createTreeOptions(): TreeOptions {
  return {
    orientation: "left",
    subtreeOffset: 8,
    siblingOffset: 5,
    indent: 10,
    multitree: false,
    align: "center",
  };
}
