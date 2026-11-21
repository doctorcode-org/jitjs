export interface MarginOptions {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

export function createMarginOptions(): MarginOptions {
  return { top: 0, left: 0, right: 0, bottom: 0 };
}
