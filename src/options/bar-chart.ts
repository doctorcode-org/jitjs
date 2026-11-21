import { empty } from "../core/util.js";

export type BarChartValueFormatter = (...arguments_: unknown[]) => boolean | string;

export interface BarChartOptions {
  animate: boolean;
  type: string;
  labelOffset: number;
  barsOffset: number;
  hoveredColor: false | string;
  orientation: "horizontal" | "vertical";
  showAggregates: boolean | BarChartValueFormatter;
  showLabels: boolean | BarChartValueFormatter;
  Tips: {
    enable: boolean;
    onShow: (...arguments_: unknown[]) => void;
    onHide: (...arguments_: unknown[]) => void;
  };
  Events: {
    enable: boolean;
    onClick: (...arguments_: unknown[]) => void;
  };
}

export function createBarChartOptions(): BarChartOptions {
  return {
    animate: true,
    type: "stacked",
    labelOffset: 3,
    barsOffset: 0,
    hoveredColor: "#9fd4ff",
    orientation: "horizontal",
    showAggregates: true,
    showLabels: true,
    Tips: { enable: false, onShow: empty, onHide: empty },
    Events: { enable: false, onClick: empty },
  };
}
