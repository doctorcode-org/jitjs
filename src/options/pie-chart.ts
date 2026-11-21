import { empty } from "../core/util.js";

export interface PieChartOptions {
  animate: boolean;
  offset: number;
  sliceOffset: number;
  labelOffset: number;
  type: string;
  hoveredColor: false | string;
  Events: {
    enable: boolean;
    onClick: (...arguments_: unknown[]) => void;
  };
  Tips: {
    enable: boolean;
    onShow: (...arguments_: unknown[]) => void;
    onHide: (...arguments_: unknown[]) => void;
  };
  showLabels: boolean;
  resizeLabels: boolean | number;
  updateHeights: boolean;
}

export function createPieChartOptions(): PieChartOptions {
  return {
    animate: true,
    offset: 25,
    sliceOffset: 0,
    labelOffset: 3,
    type: "stacked",
    hoveredColor: "#9fd4ff",
    Events: { enable: false, onClick: empty },
    Tips: { enable: false, onShow: empty, onHide: empty },
    showLabels: true,
    resizeLabels: false,
    updateHeights: false,
  };
}
