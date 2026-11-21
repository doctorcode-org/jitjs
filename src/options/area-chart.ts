import { empty } from "../core/util.js";

export type ChartValueFormatter = (...arguments_: unknown[]) => boolean | string;

export interface AreaChartOptions {
  animate: boolean;
  labelOffset: number;
  type: string;
  Tips: {
    enable: boolean;
    onShow: (...arguments_: unknown[]) => void;
    onHide: (...arguments_: unknown[]) => void;
  };
  Events: {
    enable: boolean;
    onClick: (...arguments_: unknown[]) => void;
  };
  selectOnHover: boolean;
  showAggregates: boolean | ChartValueFormatter;
  showLabels: boolean | ChartValueFormatter;
  filterOnClick: boolean;
  restoreOnRightClick: boolean;
}

export function createAreaChartOptions(): AreaChartOptions {
  return {
    animate: true,
    labelOffset: 3,
    type: "stacked",
    Tips: { enable: false, onShow: empty, onHide: empty },
    Events: { enable: false, onClick: empty },
    selectOnHover: true,
    showAggregates: true,
    showLabels: true,
    filterOnClick: false,
    restoreOnRightClick: false,
  };
}
