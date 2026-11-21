import { hexToRgb } from "../core/util.js";
import { Matrix4 } from "../geometry/matrix4.js";
import { Vector3 } from "../geometry/vector3.js";

export interface Plot3DCoordinates {
  x: number;
  y: number;
  z: number;
}

export interface Plot3DPosition {
  getc(simple: true): Plot3DCoordinates;
  setc(x: number, y: number, z: number): void;
}

export interface Plot3DInterpolatedElement {
  startPos: Plot3DPosition;
  endPos: Plot3DPosition;
  pos: Plot3DPosition;
}

export interface Plot3DVertex extends Plot3DCoordinates {}

export interface Plot3DFace {
  a: number;
  b: number;
  c: number;
  d?: number;
  normal: Plot3DCoordinates;
}

export interface Plot3DGeometry<TElement = Plot3DElement> {
  vertices: readonly Plot3DVertex[];
  faces: readonly Plot3DFace[];
  matrix: Matrix4;
  update(element: TElement): void;
}

export interface Plot3DElement {
  geometry?: Plot3DGeometry<this>;
  webGLVertexBuffer?: unknown;
  webGLFaceBuffer?: unknown;
  webGLNormalBuffer?: unknown;
  webGLFaceCount?: number;
  getData<TValue = unknown>(property: string): TValue;
}

export interface Plot3DNode extends Plot3DElement {}

export interface Plot3DEdge<TNode extends Plot3DNode = Plot3DNode>
  extends Plot3DElement {
  nodeFrom: TNode;
  nodeTo: TNode;
}

export interface Plot3DProgram {
  viewMatrix: unknown;
  projectionMatrix: unknown;
  normalMatrix: unknown;
  color: unknown;
  enableLighting: unknown;
  ambientColor: unknown;
  lightingDirection: unknown;
  directionalColor: unknown;
  position: number;
  normal: number;
}

export interface Plot3DCamera {
  matrix: Matrix4;
  projectionMatrix: Matrix4;
}

export interface Plot3DLighting {
  enable: unknown;
  ambient?: readonly [number, number, number];
  directional?: {
    color: readonly [number, number, number];
    direction: Plot3DCoordinates;
  };
}

export interface Plot3DContext {
  ARRAY_BUFFER: unknown;
  ELEMENT_ARRAY_BUFFER: unknown;
  STATIC_DRAW: unknown;
  FLOAT: unknown;
  TRIANGLES: unknown;
  UNSIGNED_SHORT: unknown;
  createBuffer(): unknown;
  bindBuffer(target: unknown, buffer: unknown): void;
  bufferData(target: unknown, data: Float32Array | Uint16Array, usage: unknown): void;
  uniformMatrix4fv(location: unknown, transpose: boolean, value: readonly number[]): void;
  uniform4f(location: unknown, x: number, y: number, z: number, w: number): void;
  uniform1i(location: unknown, value: unknown): void;
  uniform3f(location: unknown, x: number, y: number, z: number): void;
  vertexAttribPointer(
    index: number,
    size: number,
    type: unknown,
    normalized: boolean,
    stride: number,
    offset: number,
  ): void;
  drawElements(
    mode: unknown,
    count: number,
    type: unknown,
    offset: number,
  ): void;
}

export interface Plot3DCanvas {
  getCtx(): Plot3DContext;
  config: { Scene: { Lighting: Plot3DLighting } };
  canvases: readonly [{ program: Plot3DProgram; camera: Plot3DCamera }];
}

export interface Plot3DDependencies<TElement extends Plot3DElement> {
  createGeometry(type: string, element: TElement): Plot3DGeometry<TElement>;
}

export type Plot3DCompute = (
  from: number,
  to: number,
  delta: number,
) => number;

export function interpolate3DLinear(
  element: Plot3DInterpolatedElement,
  _properties: readonly string[],
  delta: number,
  compute: Plot3DCompute = (from, to, amount) =>
    from + (to - from) * amount,
): void {
  const from = element.startPos.getc(true);
  const to = element.endPos.getc(true);
  element.pos.setc(
    compute(from.x, to.x, delta),
    compute(from.y, to.y, delta),
    compute(from.z, to.z, delta),
  );
}

export function plot3DNode<TNode extends Plot3DNode>(
  node: TNode,
  canvas: Plot3DCanvas,
  dependencies: Plot3DDependencies<TNode>,
): void {
  if (node.getData("type") == "none") {
    return;
  }
  plot3DElement(node, canvas, dependencies, () =>
    node.getData<number>("alpha"),
  );
}

export function plot3DEdge<
  TNode extends Plot3DNode,
  TEdge extends Plot3DEdge<TNode>,
>(
  edge: TEdge,
  canvas: Plot3DCanvas,
  dependencies: Plot3DDependencies<TEdge>,
): void {
  if (edge.getData("type") == "none") {
    return;
  }
  plot3DElement(edge, canvas, dependencies, () =>
    Math.min(
      edge.nodeFrom.getData<number>("alpha"),
      edge.nodeTo.getData<number>("alpha"),
      edge.getData<number>("alpha"),
    ),
  );
}

export function plot3DElement<TElement extends Plot3DElement>(
  element: TElement,
  canvas: Plot3DCanvas,
  dependencies: Plot3DDependencies<TElement>,
  getAlpha: () => number,
): void {
  const context = canvas.getCtx();
  const viewMatrix = new Matrix4();
  const lighting = canvas.config.Scene.Lighting;
  const webglCanvas = canvas.canvases[0];
  const program = webglCanvas.program;
  const camera = webglCanvas.camera;

  if (!element.geometry) {
    element.geometry = dependencies.createGeometry(
      element.getData<string>("type"),
      element,
    ) as Plot3DGeometry<TElement["geometry"] extends never ? TElement : TElement>;
  }
  const geometry = element.geometry as Plot3DGeometry<TElement>;
  geometry.update(element);

  if (!element.webGLVertexBuffer) {
    const vertices: number[] = [];
    const faces: number[] = [];
    const normals: number[] = [];
    let vertexIndex = 0;

    for (const face of geometry.faces) {
      const first = geometry.vertices[face.a] as Plot3DVertex;
      const second = geometry.vertices[face.b] as Plot3DVertex;
      const third = geometry.vertices[face.c] as Plot3DVertex;
      // Truthiness of d is a deliberate 2.0.1 compatibility detail.
      const fourth = face.d
        ? (geometry.vertices[face.d] as Plot3DVertex)
        : false;
      const normal = face.normal;
      vertices.push(first.x, first.y, first.z);
      vertices.push(second.x, second.y, second.z);
      vertices.push(third.x, third.y, third.z);
      if (fourth) vertices.push(fourth.x, fourth.y, fourth.z);
      normals.push(normal.x, normal.y, normal.z);
      normals.push(normal.x, normal.y, normal.z);
      normals.push(normal.x, normal.y, normal.z);
      if (fourth) normals.push(normal.x, normal.y, normal.z);
      faces.push(vertexIndex, vertexIndex + 1, vertexIndex + 2);
      if (fourth) {
        faces.push(vertexIndex, vertexIndex + 2, vertexIndex + 3);
        vertexIndex += 4;
      } else {
        vertexIndex += 3;
      }
    }

    element.webGLVertexBuffer = context.createBuffer();
    context.bindBuffer(context.ARRAY_BUFFER, element.webGLVertexBuffer);
    context.bufferData(
      context.ARRAY_BUFFER,
      new Float32Array(vertices),
      context.STATIC_DRAW,
    );
    element.webGLFaceBuffer = context.createBuffer();
    context.bindBuffer(context.ELEMENT_ARRAY_BUFFER, element.webGLFaceBuffer);
    context.bufferData(
      context.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(faces),
      context.STATIC_DRAW,
    );
    element.webGLFaceCount = faces.length;
    element.webGLNormalBuffer = context.createBuffer();
    context.bindBuffer(context.ARRAY_BUFFER, element.webGLNormalBuffer);
    context.bufferData(
      context.ARRAY_BUFFER,
      new Float32Array(normals),
      context.STATIC_DRAW,
    );
  }

  viewMatrix.multiply(camera.matrix, geometry.matrix);
  context.uniformMatrix4fv(program.viewMatrix, false, viewMatrix.flatten());
  context.uniformMatrix4fv(
    program.projectionMatrix,
    false,
    camera.projectionMatrix.flatten(),
  );
  const normalMatrix = Matrix4.makeInvert(viewMatrix);
  normalMatrix.$transpose();
  context.uniformMatrix4fv(program.normalMatrix, false, normalMatrix.flatten());

  const color = [
    ...(hexToRgb(element.getData<string>("color")) as readonly number[]),
  ];
  color.push(getAlpha());
  context.uniform4f(
    program.color,
    (color[0] as number) / 255,
    (color[1] as number) / 255,
    (color[2] as number) / 255,
    color[3] as number,
  );
  context.uniform1i(program.enableLighting, lighting.enable);
  if (lighting.enable) {
    if (lighting.ambient) {
      context.uniform3f(
        program.ambientColor,
        lighting.ambient[0],
        lighting.ambient[1],
        lighting.ambient[2],
      );
    }
    if (lighting.directional) {
      const directional = lighting.directional;
      const position = directional.direction;
      const vector = new Vector3(position.x, position.y, position.z)
        .normalize()
        .$scale(-1);
      context.uniform3f(
        program.lightingDirection,
        vector.x,
        vector.y,
        vector.z,
      );
      context.uniform3f(
        program.directionalColor,
        directional.color[0],
        directional.color[1],
        directional.color[2],
      );
    }
  }

  context.bindBuffer(context.ARRAY_BUFFER, element.webGLVertexBuffer);
  context.vertexAttribPointer(program.position, 3, context.FLOAT, false, 0, 0);
  context.bindBuffer(context.ARRAY_BUFFER, element.webGLNormalBuffer);
  context.vertexAttribPointer(program.normal, 3, context.FLOAT, false, 0, 0);
  context.bindBuffer(context.ELEMENT_ARRAY_BUFFER, element.webGLFaceBuffer);
  context.drawElements(
    context.TRIANGLES,
    element.webGLFaceCount as number,
    context.UNSIGNED_SHORT,
    0,
  );
}
