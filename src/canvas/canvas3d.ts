import { Camera } from "../geometry/camera.js";

export interface Canvas3DSize {
  width: number;
  height: number;
}

export interface Canvas3DDocument {
  createElement(tagName: string): HTMLElement;
}

export interface Canvas3DLayerConfig extends Canvas3DSize {
  injectInto: string;
  idSuffix?: string;
}

export interface Canvas3DLayerCallbacks {
  plot?: (layer: WebGLCanvasLayer) => void;
  resize?: (width: number, height: number, layer: WebGLCanvasLayer) => void;
}

export type Canvas3DProgram = WebGLProgram & {
  viewMatrix: WebGLUniformLocation | null;
  projectionMatrix: WebGLUniformLocation | null;
  normalMatrix: WebGLUniformLocation | null;
  color: WebGLUniformLocation | null;
  enableLighting: WebGLUniformLocation | null;
  ambientColor: WebGLUniformLocation | null;
  directionalColor: WebGLUniformLocation | null;
  lightingDirection: WebGLUniformLocation | null;
  position: number;
  normal: number;
};

export const canvas3DFragmentShader = [
  "#ifdef GL_ES",
  "precision highp float;",
  "#endif",
  "varying vec4 vcolor;",
  "varying vec3 lightWeighting;",
  "void main(){",
  "gl_FragColor = vec4(vcolor.rgb * lightWeighting, vcolor.a);",
  "}",
].join("\n");

export const canvas3DVertexShader = [
  "attribute vec3 position;",
  "attribute vec3 normal;",
  "uniform vec4 color;",
  "uniform mat4 viewMatrix;",
  "uniform mat4 projectionMatrix;",
  "uniform mat4 normalMatrix;",
  "uniform bool enableLighting;",
  "uniform vec3 ambientColor;",
  "uniform vec3 directionalColor;",
  "uniform vec3 lightingDirection;",
  "varying vec4 vcolor;",
  "varying vec3 lightWeighting;",
  "void main(void) {",
  "if(!enableLighting) {",
  "lightWeighting = vec3(1.0, 1.0, 1.0);",
  "} else {",
  "vec4 transformedNormal = normalMatrix * vec4(normal, 1.0);",
  "float directionalLightWeighting = max(dot(transformedNormal.xyz, lightingDirection), 0.0);",
  "lightWeighting = ambientColor + directionalColor * directionalLightWeighting;",
  "}",
  "vcolor = color;",
  "gl_Position = projectionMatrix * viewMatrix * vec4( position, 1.0 );",
  "}",
].join("\n");

function ambientDocument(): Canvas3DDocument | undefined {
  return (globalThis as typeof globalThis & { document?: Document }).document;
}

/**
 * The optional WebGL canvas backend from JIT's `Canvas3D.js` source.
 *
 * It is intentionally a separate entry point: importing the ordinary Canvas
 * does not pull WebGL, Camera, or matrix code into a 2D bundle.
 */
export class WebGLCanvasLayer {
  readonly config: Readonly<Canvas3DLayerConfig>;
  readonly canvas: HTMLCanvasElement;
  readonly callbacks: Readonly<Canvas3DLayerCallbacks>;

  translateOffsetX = 0;
  translateOffsetY = 0;
  scaleOffsetX = 1;
  scaleOffsetY = 1;

  program: Canvas3DProgram;
  camera: Camera;

  private context: WebGLRenderingContext | undefined;
  private size: Canvas3DSize | undefined;

  constructor(
    config: Canvas3DLayerConfig,
    callbacks: Canvas3DLayerCallbacks = {},
    ownerDocument?: Canvas3DDocument,
  ) {
    const documentDependency = ownerDocument ?? ambientDocument();
    if (!documentDependency) {
      throw new Error(
        "WebGLCanvasLayer requires an injected document when no browser document is available",
      );
    }

    this.config = { ...config };
    this.callbacks = callbacks;
    const canvas = documentDependency.createElement("canvas") as HTMLCanvasElement;
    canvas.id = `${config.injectInto}${config.idSuffix ?? "-canvas"}`;
    canvas.width = config.width;
    canvas.height = config.height;
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = `${config.width}px`;
    canvas.style.height = `${config.height}px`;
    this.canvas = canvas;

    this.program = this.initWebGL();
    this.camera = this.initCamera();
  }

  getCtx(): WebGLRenderingContext {
    if (this.context) return this.context;
    const context = this.canvas.getContext(
      "experimental-webgl",
    ) as WebGLRenderingContext | null;
    if (!context) {
      throw new Error("An experimental WebGL rendering context is not available");
    }
    this.context = context;
    return context;
  }

  getSize(): Canvas3DSize {
    if (!this.size) {
      this.size = { width: this.canvas.width, height: this.canvas.height };
    }
    return this.size;
  }

  getShader(source: string, type: number): WebGLShader {
    const context = this.getCtx();
    const shader = context.createShader(type);
    if (!shader) {
      throw new Error("Could not create shader");
    }
    context.shaderSource(shader, source);
    context.compileShader(shader);
    if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
      throw `Could not compile shader src: ${context.getShaderInfoLog(shader)}`;
    }
    return shader;
  }

  /** The 3D backend deliberately has no centered 2D transform. */
  translateToCenter(): void {}

  /** Scaling was an empty operation in the original WebGL backend. */
  scale(_x: number, _y: number, _disablePlot = false): void {}

  resize(width: number, height: number): void {
    const context = this.getCtx();
    this.size = undefined;
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    context.viewport(0, 0, width, height);
    this.translateOffsetX = 0;
    this.translateOffsetY = 0;
    this.scaleOffsetX = 1;
    this.scaleOffsetY = 1;
    this.clear();
    this.callbacks.resize?.(width, height, this);
  }

  translate(x: number, y: number, z: number, disablePlot = false): void {
    this.translateOffsetX += x * this.scaleOffsetX;
    this.translateOffsetY += y * this.scaleOffsetY;
    this.camera.position.x += x;
    this.camera.position.y += y;
    this.camera.position.z += z;
    if (!disablePlot) this.plot();
  }

  clear(): void {
    const context = this.getCtx();
    context.clear(context.COLOR_BUFFER_BIT | context.DEPTH_BUFFER_BIT);
    this.camera.updateMatrix();
  }

  plot(): void {
    this.clear();
    this.callbacks.plot?.(this);
  }

  private initWebGL(): Canvas3DProgram {
    const context = this.getCtx();
    const size = this.getSize();
    const fragmentShader = this.getShader(
      canvas3DFragmentShader,
      context.FRAGMENT_SHADER,
    );
    const vertexShader = this.getShader(
      canvas3DVertexShader,
      context.VERTEX_SHADER,
    );
    const rawProgram = context.createProgram();
    if (!rawProgram) {
      throw new Error("Could not create WebGL program");
    }
    context.attachShader(rawProgram, vertexShader);
    context.attachShader(rawProgram, fragmentShader);
    context.linkProgram(rawProgram);
    if (!context.getProgramParameter(rawProgram, context.LINK_STATUS)) {
      throw "Could not link shaders";
    }
    context.useProgram(rawProgram);

    const program = rawProgram as Canvas3DProgram;
    program.viewMatrix = context.getUniformLocation(rawProgram, "viewMatrix");
    program.projectionMatrix = context.getUniformLocation(
      rawProgram,
      "projectionMatrix",
    );
    program.normalMatrix = context.getUniformLocation(rawProgram, "normalMatrix");
    program.color = context.getUniformLocation(rawProgram, "color");
    program.enableLighting = context.getUniformLocation(
      rawProgram,
      "enableLighting",
    );
    program.ambientColor = context.getUniformLocation(rawProgram, "ambientColor");
    program.directionalColor = context.getUniformLocation(
      rawProgram,
      "directionalColor",
    );
    program.lightingDirection = context.getUniformLocation(
      rawProgram,
      "lightingDirection",
    );
    program.position = context.getAttribLocation(rawProgram, "position");
    program.normal = context.getAttribLocation(rawProgram, "normal");
    context.enableVertexAttribArray(program.position);
    context.enableVertexAttribArray(program.normal);

    context.clearColor(0, 0, 0, 0);
    context.clearDepth(1);
    context.enable(context.DEPTH_TEST);
    context.depthFunc(context.LEQUAL);
    context.enable(context.BLEND);
    context.blendFunc(context.SRC_ALPHA, context.ONE_MINUS_SRC_ALPHA);
    context.viewport(0, 0, size.width, size.height);
    return program;
  }

  private initCamera(): Camera {
    const size = this.getSize();
    const camera = new Camera(75, size.width / size.height, 1, 1000);
    camera.position.z = 500;
    return camera;
  }
}

/** Direct-constructor alias for consumers replacing the old 3D base registry. */
export { WebGLCanvasLayer as Canvas3DLayer };
