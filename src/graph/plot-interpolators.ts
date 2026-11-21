import {
  interpolateEdgeProperties,
  interpolateEdgeStyles,
  interpolateLabelProperties,
  interpolateLinearPosition,
  interpolateMoebiusPosition,
  interpolateNodeProperties,
  interpolateNodeStyles,
  interpolatePolarPosition,
  type EdgeInterpolationSource,
  type MoebiusVector,
  type PositionInterpolationTarget,
  type PropertyInterpolationTarget,
} from "./interpolation.js";
import type { PlotModeInterpolator } from "./plot-animation.js";

export type BuiltInPlotInterpolationNode = PositionInterpolationTarget &
  PropertyInterpolationTarget &
  EdgeInterpolationSource;

export type BuiltInPlotModeInterpolator = PlotModeInterpolator<
  BuiltInPlotInterpolationNode,
  MoebiusVector
>;

export const linearPlotInterpolator: BuiltInPlotModeInterpolator = (
  node,
  _properties,
  delta,
) => interpolateLinearPosition(node, delta);

export const polarPlotInterpolator: BuiltInPlotModeInterpolator = (
  node,
  _properties,
  delta,
) => interpolatePolarPosition(node, delta);

export const moebiusPlotInterpolator: BuiltInPlotModeInterpolator = (
  node,
  _properties,
  delta,
  versor,
) => interpolateMoebiusPosition(node, delta, versor as MoebiusVector);

export const nodePropertyPlotInterpolator: BuiltInPlotModeInterpolator = (
  node,
  properties,
  delta,
) => interpolateNodeProperties(node, properties, delta);

export const edgePropertyPlotInterpolator: BuiltInPlotModeInterpolator = (
  node,
  properties,
  delta,
) => interpolateEdgeProperties(node, properties, delta);

export const labelPropertyPlotInterpolator: BuiltInPlotModeInterpolator = (
  node,
  properties,
  delta,
) => interpolateLabelProperties(node, properties, delta);

export const nodeStylePlotInterpolator: BuiltInPlotModeInterpolator = (
  node,
  properties,
  delta,
) => interpolateNodeStyles(node, properties, delta);

export const edgeStylePlotInterpolator: BuiltInPlotModeInterpolator = (
  node,
  properties,
  delta,
) => interpolateEdgeStyles(node, properties, delta);
