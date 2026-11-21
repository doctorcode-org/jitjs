"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // dist/canvas/canvas.js
  var SVG_NAMESPACE = "http://www.w3.org/2000/svg";
  function ambientDocument() {
    return globalThis.document;
  }
  function resolveDocument(target, supplied) {
    const ownerDocument = typeof target === "string" ? void 0 : target.ownerDocument;
    const resolved = supplied ?? ownerDocument ?? ambientDocument();
    if (!resolved) {
      throw new Error("Canvas requires an injected document when no browser document is available");
    }
    return resolved;
  }
  function resolveHost(target, ownerDocument) {
    if (typeof target !== "string") {
      return target;
    }
    const host2 = ownerDocument.getElementById(target);
    if (!host2) {
      throw new Error(`Canvas host element was not found: ${target}`);
    }
    return host2;
  }
  function setAbsoluteSize(element, width, height) {
    element.style.position = "absolute";
    element.style.top = "0";
    element.style.left = "0";
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
  }
  function defaultPosition(element) {
    let offsetX = 0;
    let offsetY = 0;
    let offsetElement = element;
    while (offsetElement && !/^(?:body|html)$/i.test(offsetElement.tagName)) {
      offsetX += offsetElement.offsetLeft;
      offsetY += offsetElement.offsetTop;
      offsetElement = offsetElement.offsetParent;
    }
    let scrollX = 0;
    let scrollY = 0;
    let scrollElement = element;
    while (scrollElement && !/^(?:body|html)$/i.test(scrollElement.tagName)) {
      scrollX += scrollElement.scrollLeft;
      scrollY += scrollElement.scrollTop;
      scrollElement = scrollElement.parentNode;
    }
    return { x: offsetX - scrollX, y: offsetY - scrollY };
  }
  var CanvasLayer = class {
    constructor(config2, callbacks = {}, ownerDocument) {
      __publicField(this, "config");
      __publicField(this, "canvas");
      __publicField(this, "translateOffsetX", 0);
      __publicField(this, "translateOffsetY", 0);
      __publicField(this, "scaleOffsetX", 1);
      __publicField(this, "scaleOffsetY", 1);
      __publicField(this, "callbacks");
      __publicField(this, "context");
      __publicField(this, "size");
      const documentDependency = ownerDocument ?? ambientDocument();
      if (!documentDependency) {
        throw new Error("Canvas.Layer requires an injected document when no browser document is available");
      }
      this.config = { ...config2 };
      this.callbacks = callbacks;
      const canvas2 = documentDependency.createElement("canvas");
      canvas2.id = `${config2.injectInto}${config2.idSuffix ?? "-canvas"}`;
      canvas2.width = config2.width;
      canvas2.height = config2.height;
      setAbsoluteSize(canvas2, config2.width, config2.height);
      this.canvas = canvas2;
      this.translateToCenter();
    }
    getCtx() {
      if (this.context) {
        return this.context;
      }
      const context = this.canvas.getContext("2d");
      if (!context) {
        throw new Error("A 2D rendering context is not available");
      }
      this.context = context;
      return context;
    }
    getSize() {
      if (!this.size) {
        this.size = {
          width: this.canvas.width,
          height: this.canvas.height
        };
      }
      return this.size;
    }
    translateToCenter() {
      const size2 = this.getSize();
      this.getCtx().translate(size2.width / 2, size2.height / 2);
    }
    resize(width, height) {
      const styles = this.canvas.style;
      this.size = void 0;
      this.canvas.width = width;
      this.canvas.height = height;
      styles.width = `${width}px`;
      styles.height = `${height}px`;
      this.translateToCenter();
      this.translateOffsetX = 0;
      this.translateOffsetY = 0;
      this.scaleOffsetX = 1;
      this.scaleOffsetY = 1;
      this.clear();
      this.callbacks.resize?.(width, height, this);
    }
    translate(x, y, disablePlot = false) {
      this.translateOffsetX += x * this.scaleOffsetX;
      this.translateOffsetY += y * this.scaleOffsetY;
      this.getCtx().translate(x, y);
      if (!disablePlot) {
        this.plot();
      }
    }
    scale(x, y, disablePlot = false) {
      this.scaleOffsetX *= x;
      this.scaleOffsetY *= y;
      this.getCtx().scale(x, y);
      if (!disablePlot) {
        this.plot();
      }
    }
    clear() {
      const size2 = this.getSize();
      const reciprocalX = 1 / this.scaleOffsetX;
      const reciprocalY = 1 / this.scaleOffsetY;
      this.getCtx().clearRect((-size2.width / 2 - this.translateOffsetX) * reciprocalX, (-size2.height / 2 - this.translateOffsetY) * reciprocalY, size2.width * reciprocalX, size2.height * reciprocalY);
    }
    plot() {
      this.clear();
      this.callbacks.plot?.(this);
    }
  };
  var Canvas = class {
    constructor(viz, options, environment = {}) {
      __publicField(this, "viz");
      __publicField(this, "opt");
      __publicField(this, "config");
      __publicField(this, "id");
      __publicField(this, "element");
      __publicField(this, "labelContainer");
      __publicField(this, "labelRoot");
      __publicField(this, "canvases");
      __publicField(this, "translateOffsetX", 0);
      __publicField(this, "translateOffsetY", 0);
      __publicField(this, "scaleOffsetX", 1);
      __publicField(this, "scaleOffsetY", 1);
      __publicField(this, "position");
      __publicField(this, "getPosition");
      __publicField(this, "scrollWindow");
      __publicField(this, "scrollListener");
      __publicField(this, "scrollTimer");
      if (options.type !== void 0 && options.type !== "2D") {
        throw new Error(`Unsupported canvas type: ${String(options.type)}`);
      }
      this.viz = viz;
      this.opt = options;
      this.config = options;
      const ownerDocument = resolveDocument(options.injectInto, environment.document);
      const host2 = resolveHost(options.injectInto, ownerDocument);
      this.id = typeof options.injectInto === "string" ? options.injectInto : options.injectInto.id;
      if (!this.id) {
        throw new Error("Canvas host element must have an id");
      }
      const width = options.width || host2.offsetWidth;
      const height = options.height || host2.offsetHeight;
      this.getPosition = environment.getPosition ?? defaultPosition;
      const element = ownerDocument.createElement("div");
      element.id = `${this.id}-canvaswidget`;
      element.style.position = "relative";
      element.style.width = `${width}px`;
      element.style.height = `${height}px`;
      this.element = element;
      const labels = this.createLabelContainer(options.Label?.type ?? "HTML", `${this.id}-label`, { width, height }, ownerDocument);
      this.labelContainer = labels.container;
      this.labelRoot = labels.root;
      const primary = new CanvasLayer({
        injectInto: this.id,
        idSuffix: "-canvas",
        width,
        height
      }, {
        plot: () => this.viz.fx.plot(),
        resize: () => this.viz.refresh()
      }, ownerDocument);
      this.canvases = [primary];
      for (const definition of options.layers ?? []) {
        const layer = new CanvasLayer({
          injectInto: this.id,
          idSuffix: definition.idSuffix,
          width,
          height
        }, definition, ownerDocument);
        this.canvases.push(layer);
      }
      for (let index = this.canvases.length - 1; index >= 0; index -= 1) {
        const layer = this.canvases[index];
        this.element.appendChild(layer.canvas);
        if (index > 0) {
          layer.plot();
        }
      }
      this.element.appendChild(this.labelContainer);
      host2.appendChild(this.element);
      if (environment.window) {
        this.observeScroll(environment.window);
      }
    }
    getCtx(index = 0) {
      return this.getLayer(index).getCtx();
    }
    getConfig() {
      return this.opt;
    }
    getElement() {
      return this.element;
    }
    /** The direct parent for labels (`div` for HTML, inner `g` for SVG). */
    getLabelRoot() {
      return this.labelRoot;
    }
    getSize(index = 0) {
      return this.getLayer(index).getSize();
    }
    resize(width, height) {
      this.getPos(true);
      this.translateOffsetX = 0;
      this.translateOffsetY = 0;
      this.scaleOffsetX = 1;
      this.scaleOffsetY = 1;
      for (const layer of this.canvases) {
        layer.resize(width, height);
      }
      this.element.style.width = `${width}px`;
      this.element.style.height = `${height}px`;
      this.labelContainer.style.width = `${width}px`;
      if (this.labelContainer.namespaceURI === SVG_NAMESPACE) {
        this.labelContainer.setAttribute("width", String(width));
        this.labelContainer.setAttribute("height", String(height));
      }
    }
    translate(x, y, disablePlot = false) {
      this.translateOffsetX += x * this.scaleOffsetX;
      this.translateOffsetY += y * this.scaleOffsetY;
      for (const layer of this.canvases) {
        layer.translate(x, y, disablePlot);
      }
    }
    scale(x, y, _disablePlot = false) {
      const scaleX = this.scaleOffsetX * x;
      const scaleY = this.scaleOffsetY * y;
      const translateX = this.translateOffsetX * (x - 1) / scaleX;
      const translateY = this.translateOffsetY * (y - 1) / scaleY;
      this.scaleOffsetX = scaleX;
      this.scaleOffsetY = scaleY;
      for (const layer of this.canvases) {
        layer.scale(x, y, true);
      }
      this.translate(translateX, translateY, false);
    }
    getPos(force = false) {
      if (force || !this.position) {
        this.position = this.getPosition(this.element);
      }
      return this.position;
    }
    clear(index = 0) {
      this.getLayer(index).clear();
    }
    path(type, action) {
      const context = this.getCtx();
      context.beginPath();
      action(context);
      context[type]();
      context.closePath();
    }
    /** Remove the optional scroll observer installed through the environment. */
    dispose() {
      if (this.scrollWindow && this.scrollListener) {
        this.scrollWindow.removeEventListener("scroll", this.scrollListener);
      }
      if (this.scrollWindow && this.scrollTimer !== void 0) {
        this.scrollWindow.clearTimeout(this.scrollTimer);
      }
      this.scrollWindow = void 0;
      this.scrollListener = void 0;
      this.scrollTimer = void 0;
    }
    getLayer(index) {
      const layer = this.canvases[index];
      if (!layer) {
        throw new RangeError(`Canvas layer index is out of range: ${index}`);
      }
      return layer;
    }
    createLabelContainer(type, id, size2, ownerDocument) {
      if (type === "HTML" || type === "Native") {
        const container = ownerDocument.createElement("div");
        container.id = id;
        container.style.overflow = "visible";
        container.style.position = "absolute";
        container.style.top = "0";
        container.style.left = "0";
        container.style.width = `${size2.width}px`;
        container.style.height = "0";
        return { container, root: container };
      }
      const svg = ownerDocument.createElementNS(SVG_NAMESPACE, "svg");
      svg.setAttribute("width", String(size2.width));
      svg.setAttribute("height", String(size2.height));
      svg.style.position = "absolute";
      svg.style.left = "0px";
      svg.style.top = "0px";
      const group = ownerDocument.createElementNS(SVG_NAMESPACE, "g");
      group.setAttribute("width", String(size2.width));
      group.setAttribute("height", String(size2.height));
      group.setAttribute("x", "0");
      group.setAttribute("y", "0");
      group.setAttribute("id", id);
      svg.appendChild(group);
      return { container: svg, root: group };
    }
    observeScroll(targetWindow) {
      this.scrollWindow = targetWindow;
      this.scrollListener = (() => {
        if (this.scrollTimer !== void 0) {
          targetWindow.clearTimeout(this.scrollTimer);
        }
        this.scrollTimer = targetWindow.setTimeout(() => {
          this.getPos(true);
          this.scrollTimer = void 0;
        }, 500);
      });
      targetWindow.addEventListener("scroll", this.scrollListener);
    }
  };
  /** Modern direct replacements for the old `Canvas.Base['2D']` registry. */
  __publicField(Canvas, "Base", CanvasLayer);
  __publicField(Canvas, "Layer", CanvasLayer);

  // dist/core/util.js
  var objectToString = Object.prototype.toString;
  function empty() {
  }
  function extend(original, extended) {
    const extension = extended || {};
    for (const key in extension) {
      original[key] = extension[key];
    }
    return original;
  }
  var time = Date.now;
  function typeOf(value) {
    const match = objectToString.call(value).match(/^\[object\s(.*)\]$/);
    const type = (match?.[1] ?? "").toLowerCase();
    if (type !== "object") {
      return type;
    }
    const candidate = value;
    if (candidate?.$$family) {
      return candidate.$$family;
    }
    return candidate?.nodeName && candidate.nodeType === 1 ? "element" : type;
  }
  function splat(value) {
    return typeOf(value) === "array" ? value : [value];
  }
  function unlink(value) {
    switch (typeOf(value)) {
      case "object": {
        const result = {};
        for (const key in value) {
          result[key] = unlink(value[key]);
        }
        return result;
      }
      case "array": {
        const source = value;
        const result = [];
        for (let index = 0; index < source.length; index += 1) {
          result[index] = unlink(source[index]);
        }
        return result;
      }
      default:
        return value;
    }
  }
  function merge(...sources) {
    const result = {};
    for (const source of sources) {
      if (typeOf(source) !== "object") {
        continue;
      }
      for (const key in source) {
        const incoming = source[key];
        const current = result[key];
        result[key] = current && typeOf(incoming) === "object" && typeOf(current) === "object" ? merge(current, incoming) : unlink(incoming);
      }
    }
    return result;
  }
  function rgbToHex(source, asArray = false) {
    if (source.length < 3) {
      return null;
    }
    if (source.length === 4 && source[3] === 0 && !asArray) {
      return "transparent";
    }
    const hex2 = source.slice(0, 3).map((component) => {
      const value = Number(component).toString(16);
      return value.length === 1 ? `0${value}` : value;
    });
    return asArray ? hex2 : `#${hex2.join("")}`;
  }
  function hexToRgb(hex2) {
    if (hex2.length === 7) {
      const value = Number.parseInt(hex2.slice(1), 16);
      return [value >> 16, value >> 8 & 255, value & 255];
    }
    const components = hex2.match(/^#?(\w{1,2})(\w{1,2})(\w{1,2})$/);
    if (!components) {
      return null;
    }
    const rgb = components.slice(1).map((component) => {
      const normalized = component.length === 1 ? `${component}${component}` : component;
      return Number.parseInt(normalized, 16);
    });
    return rgb.length === 3 ? rgb : null;
  }

  // dist/graph/interpolation.js
  var DATA_PROPERTIES = [
    "border",
    "color",
    "width",
    "height",
    "dim",
    "alpha",
    "lineWidth",
    "angularWidth",
    "span",
    "valueArray",
    "dimArray"
  ];
  var CANVAS_PROPERTIES = [
    "globalAlpha",
    "fillStyle",
    "strokeStyle",
    "lineWidth",
    "shadowBlur",
    "shadowColor",
    "shadowOffsetX",
    "shadowOffsetY",
    "miterLimit"
  ];
  var LABEL_PROPERTIES = ["size", "color"];
  function interpolateNumber(from, to, delta) {
    return from + (to - from) * delta;
  }
  function interpolateColor(from, to, delta) {
    const fromRgb = hexToRgb(from);
    const toRgb = hexToRgb(to);
    const components = [
      Number.parseInt(String(interpolateNumber(fromRgb[0], toRgb[0], delta))),
      Number.parseInt(String(interpolateNumber(fromRgb[1], toRgb[1], delta))),
      Number.parseInt(String(interpolateNumber(fromRgb[2], toRgb[2], delta)))
    ];
    return rgbToHex(components);
  }
  function interpolateNumberArray(from, to, delta) {
    const current = [];
    for (let index = 0; index < from.length; index += 1) {
      const fromValue = from[index];
      const toValue = to[index];
      if (Array.isArray(fromValue) && fromValue.length > 0) {
        const nested = [];
        for (let nestedIndex = 0; nestedIndex < fromValue.length; nestedIndex += 1) {
          nested.push(interpolateNumber(fromValue[nestedIndex], toValue[nestedIndex], delta));
        }
        current.push(nested);
      } else {
        current.push(interpolateNumber(fromValue, toValue, delta));
      }
    }
    return current;
  }
  function interpolatePolygon(fromValue, toValue, delta) {
    let from = fromValue;
    const to = toValue;
    if (typeof from.offset === "undefined") {
      if (from === 0) {
        from = to.map(() => ({ x: 0, y: 0 }));
        from.offset = 0;
      } else {
        if (from.length === 0)
          from.push({ x: 0, y: 0 });
        while (from.length < to.length)
          from.push(from[0]);
        while (from.length > to.length) {
          to.push(to[0] ?? { x: 0, y: 0 });
        }
        if (from.length === 0)
          return [];
        let minimumDistance = 1e300;
        for (let offset2 = 0; offset2 < from.length; offset2 += 1) {
          let distance = 0;
          for (let index = 0; index < from.length; index += 1) {
            const source = from[(offset2 + index) % from.length];
            const target = to[index];
            const dx = source.x - target.x;
            const dy = source.y - target.y;
            distance += dx * dx + dy * dy;
          }
          if (distance < minimumDistance) {
            from.offset = offset2;
            minimumDistance = distance;
          }
        }
      }
    }
    const polygonFrom = from;
    const current = [];
    const offset = polygonFrom.offset;
    for (let index = 0; index < polygonFrom.length; index += 1) {
      const source = polygonFrom[(index + offset) % polygonFrom.length];
      const target = to[index];
      current.push({
        x: interpolateNumber(source.x, target.x, delta),
        y: interpolateNumber(source.y, target.y, delta)
      });
    }
    return current;
  }
  function interpolateLinearPosition(element, delta) {
    const from = element.startPos.getc(true);
    const to = element.endPos.getc(true);
    element.pos.setc(interpolateNumber(from.x, to.x, delta), interpolateNumber(from.y, to.y, delta));
  }
  function propertyKind(channel2, property) {
    if (channel2 === "data") {
      switch (property) {
        case "border":
        case "color":
          return "color";
        case "valueArray":
        case "dimArray":
          return "array-number";
        case "vertices":
          return "polygon";
        case "width":
        case "height":
        case "dim":
        case "alpha":
        case "lineWidth":
        case "angularWidth":
        case "span":
          return "number";
        default:
          throw new TypeError(`Unsupported data interpolation property: ${property}`);
      }
    }
    if (channel2 === "canvas") {
      switch (property) {
        case "fillStyle":
        case "strokeStyle":
        case "shadowColor":
          return "color";
        case "globalAlpha":
        case "lineWidth":
        case "shadowBlur":
        case "shadowOffsetX":
        case "shadowOffsetY":
        case "miterLimit":
          return "number";
        default:
          throw new TypeError(`Unsupported canvas interpolation property: ${property}`);
      }
    }
    switch (property) {
      case "color":
        return "color";
      case "size":
        return "number";
      default:
        throw new TypeError(`Unsupported label interpolation property: ${property}`);
    }
  }
  function defaultProperties(channel2) {
    if (channel2 === "data")
      return DATA_PROPERTIES;
    if (channel2 === "canvas")
      return CANVAS_PROPERTIES;
    return LABEL_PROPERTIES;
  }
  function getProperty(element, channel2, property, phase) {
    if (channel2 === "data")
      return element.getData(property, phase);
    if (channel2 === "canvas")
      return element.getCanvasStyle(property, phase);
    return element.getLabelData(property, phase);
  }
  function setProperty(element, channel2, property, value) {
    if (channel2 === "data") {
      element.setData(property, value);
    } else if (channel2 === "canvas") {
      element.setCanvasStyle(property, value);
    } else {
      element.setLabelData(property, value);
    }
  }
  function interpolateProperty(element, channel2, property, delta) {
    const from = getProperty(element, channel2, property, "start");
    const to = getProperty(element, channel2, property, "end");
    let value;
    switch (propertyKind(channel2, property)) {
      case "number":
        value = interpolateNumber(from, to, delta);
        break;
      case "color":
        value = interpolateColor(from, to, delta);
        break;
      case "array-number":
        value = interpolateNumberArray(from, to, delta);
        break;
      case "polygon":
        value = interpolatePolygon(from, to, delta);
        break;
    }
    setProperty(element, channel2, property, value);
  }
  function interpolateProperties(element, channel2, properties, delta) {
    const selected = properties ?? defaultProperties(channel2);
    for (const property of selected) {
      interpolateProperty(element, channel2, property, delta);
    }
  }
  function interpolateNodeProperties(element, properties, delta) {
    interpolateProperties(element, "data", properties, delta);
  }

  // dist/graph/plot-interpolators.js
  var linearPlotInterpolator = (node, _properties, delta) => interpolateLinearPosition(node, delta);
  var nodePropertyPlotInterpolator = (node, properties, delta) => interpolateNodeProperties(node, properties, delta);

  // dist/graph/labels/native.js
  function renderNativeLabel(canvas2, node, _controller) {
    const position = node.pos.getc(true);
    canvas2.getCtx().fillText(node.name, position.x, position.y + node.getData("height") / 2);
  }
  var NativeLabels = class {
    constructor(renderer = renderNativeLabel) {
      __publicField(this, "renderer");
      this.renderer = renderer;
    }
    plotLabel(canvas2, node, controller) {
      const context = canvas2.getCtx();
      context.font = `${node.getLabelData("style")} ${node.getLabelData("size")}px ${node.getLabelData("family")}`;
      context.textAlign = node.getLabelData("textAlign");
      context.fillStyle = context.strokeStyle = node.getLabelData("color");
      context.textBaseline = node.getLabelData("textBaseline");
      this.renderer(canvas2, node, controller);
    }
    hideLabel(_node, _show) {
    }
    hideLabels(_hide) {
    }
  };

  // dist/layouts/treemap/slice-and-dice.js
  var SliceAndDiceTreemapLayout = class {
    constructor(dependencies) {
      __publicField(this, "graph");
      __publicField(this, "root");
      __publicField(this, "getSize");
      __publicField(this, "config");
      __publicField(this, "controller");
      __publicField(this, "clickedNode");
      __publicField(this, "orientation");
      this.graph = dependencies.graph;
      this.root = dependencies.root;
      this.getSize = dependencies.getSize;
      this.controller = dependencies.controller || {
        onBeforeCompute: () => {
        },
        onAfterCompute: () => {
        }
      };
      this.clickedNode = dependencies.clickedNode ?? null;
      const config2 = dependencies.config || {};
      this.config = {
        ...config2,
        orientation: config2.orientation ?? "h",
        titleHeight: config2.titleHeight ?? 13,
        offset: config2.offset ?? 2
      };
      this.orientation = this.config.orientation;
    }
    horizontal() {
      return this.orientation === "h";
    }
    vertical() {
      return this.orientation === "v";
    }
    changeOrientation() {
      this.orientation = this.vertical() ? "h" : "v";
    }
    compute(property) {
      const root = this.requireNode(this.clickedNode?.id || this.root);
      this.controller.onBeforeCompute(root);
      const { width, height } = this.getSize();
      this.graph.computeLevels(this.root, 0, "ignore");
      root.getPos(property).setc(-width / 2, -height / 2);
      root.setData("width", width, property);
      root.setData("height", height + this.config.titleHeight, property);
      this.computePositions(root, root, this.orientation, property);
      this.controller.onAfterCompute(root);
    }
    computePositions(parent, child, requestedOrientation, property) {
      let totalArea = 0;
      parent.eachSubnode((node) => {
        totalArea += node.getData("area", property);
      });
      const width = parent.getData("width", property);
      const height = Math.max(parent.getData("height", property) - this.config.titleHeight, 0);
      const factor = parent === child ? 1 : child.getData("area", property) / totalArea;
      let orientation;
      let otherSize;
      let size2;
      let dimension;
      let positionAxis;
      let otherPositionAxis;
      let titleOffset;
      let otherTitleOffset;
      if (requestedOrientation === "h") {
        orientation = "v";
        otherSize = height;
        size2 = width * factor;
        dimension = "height";
        positionAxis = "y";
        otherPositionAxis = "x";
        titleOffset = this.config.titleHeight;
        otherTitleOffset = 0;
      } else {
        orientation = "h";
        otherSize = height * factor;
        size2 = width;
        dimension = "width";
        positionAxis = "x";
        otherPositionAxis = "y";
        titleOffset = 0;
        otherTitleOffset = this.config.titleHeight;
      }
      const childPosition = child.getPos(property);
      child.setData("width", size2, property);
      child.setData("height", otherSize, property);
      let offsetSize = 0;
      child.eachSubnode((node) => {
        const position = node.getPos(property);
        position[positionAxis] = offsetSize + childPosition[positionAxis] + titleOffset;
        position[otherPositionAxis] = childPosition[otherPositionAxis] + otherTitleOffset;
        this.computePositions(child, node, orientation, property);
        offsetSize += node.getData(dimension, property);
      });
    }
    requireNode(id) {
      const node = this.graph.getNode(id);
      if (!node) {
        throw new Error(`Unknown graph node: ${id}`);
      }
      return node;
    }
  };

  // dist/core/easing.js
  function withEasing(transition, parameters) {
    const easingParameters = Array.isArray(parameters) ? parameters : [parameters];
    return Object.assign(transition, {
      easeIn(position) {
        return transition(position, easingParameters);
      },
      easeOut(position) {
        return 1 - transition(1 - position, easingParameters);
      },
      easeInOut(position) {
        return position <= 0.5 ? transition(2 * position, easingParameters) / 2 : (2 - transition(2 * (1 - position), easingParameters)) / 2;
      }
    });
  }
  function polynomialTransition(power) {
    return (position) => Math.pow(position, power);
  }
  var Quad = /* @__PURE__ */ withEasing(polynomialTransition(2));
  var Cubic = /* @__PURE__ */ withEasing(polynomialTransition(3));
  var Quart = /* @__PURE__ */ withEasing(polynomialTransition(4));
  var Quint = /* @__PURE__ */ withEasing(polynomialTransition(5));

  // dist/core/animation.js
  var Animation = class {
    constructor(options) {
      __publicField(this, "$$family", "class");
      this.setOptions(options);
    }
    setOptions(options) {
      const defaults = {
        duration: 2500,
        fps: 40,
        transition: Quart.easeInOut,
        compute: empty,
        complete: empty,
        link: "ignore"
      };
      this.opt = merge(defaults, options || {});
      return this;
    }
    step() {
      const currentTime = time();
      const options = this.opt;
      if (currentTime < this.time + options.duration) {
        const delta = options.transition((currentTime - this.time) / options.duration);
        options.compute(delta);
      } else {
        clearInterval(this.timer);
        this.timer = void 0;
        options.compute(1);
        options.complete();
      }
    }
    start() {
      if (!this.check()) {
        return this;
      }
      this.time = 0;
      this.startTimer();
      return this;
    }
    startTimer() {
      if (this.timer) {
        return false;
      }
      this.time = time() - this.time;
      this.timer = setInterval(() => {
        this.step();
      }, Math.round(1e3 / this.opt.fps));
      return true;
    }
    pause() {
      this.stopTimer();
      return this;
    }
    resume() {
      this.startTimer();
      return this;
    }
    stopTimer() {
      if (!this.timer) {
        return false;
      }
      this.time = time() - this.time;
      clearInterval(this.timer);
      this.timer = void 0;
      return true;
    }
    check() {
      if (!this.timer) {
        return true;
      }
      if (this.opt.link == "cancel") {
        this.stopTimer();
        return true;
      }
      return false;
    }
  };

  // dist/core/geometry.js
  var _Polar = class _Polar {
    constructor(theta, rho) {
      __publicField(this, "theta");
      __publicField(this, "rho");
      this.theta = theta || 0;
      this.rho = rho || 0;
    }
    getc(simple = false) {
      return this.toComplex(simple);
    }
    getp() {
      return this;
    }
    set(value) {
      const polar = value.getp();
      this.theta = polar.theta;
      this.rho = polar.rho;
    }
    setc(x, y) {
      this.rho = Math.sqrt(x * x + y * y);
      this.theta = Math.atan2(y, x);
      if (this.theta < 0) {
        this.theta += Math.PI * 2;
      }
    }
    setp(theta, rho) {
      this.theta = theta;
      this.rho = rho;
    }
    clone() {
      return new _Polar(this.theta, this.rho);
    }
    toComplex(simple = false) {
      const x = Math.cos(this.theta) * this.rho;
      const y = Math.sin(this.theta) * this.rho;
      return simple ? { x, y } : new Complex(x, y);
    }
    add(polar) {
      return new _Polar(this.theta + polar.theta, this.rho + polar.rho);
    }
    scale(factor) {
      return new _Polar(this.theta, this.rho * factor);
    }
    equals(polar) {
      return this.theta == polar.theta && this.rho == polar.rho;
    }
    $add(polar) {
      this.theta += polar.theta;
      this.rho += polar.rho;
      return this;
    }
    $madd(polar) {
      this.theta = (this.theta + polar.theta) % (Math.PI * 2);
      this.rho += polar.rho;
      return this;
    }
    $scale(factor) {
      this.rho *= factor;
      return this;
    }
    isZero() {
      const almostZero = 1e-4;
      return Math.abs(this.theta) < almostZero && Math.abs(this.rho) < almostZero;
    }
    interpolate(element, delta) {
      const pi = Math.PI;
      const pi2 = pi * 2;
      const normalizeAngle = (theta2) => theta2 < 0 ? theta2 % pi2 + pi2 : theta2 % pi2;
      const theta = this.theta;
      const elementTheta = element.theta;
      const difference = Math.abs(theta - elementTheta);
      let interpolatedTheta;
      if (difference == pi) {
        if (theta > elementTheta) {
          interpolatedTheta = normalizeAngle(elementTheta + (theta - pi2 - elementTheta) * delta);
        } else {
          interpolatedTheta = normalizeAngle(elementTheta - pi2 + (theta - elementTheta) * delta);
        }
      } else if (difference >= pi) {
        if (theta > elementTheta) {
          interpolatedTheta = normalizeAngle(elementTheta + (theta - pi2 - elementTheta) * delta);
        } else {
          interpolatedTheta = normalizeAngle(elementTheta - pi2 + (theta - (elementTheta - pi2)) * delta);
        }
      } else {
        interpolatedTheta = normalizeAngle(elementTheta + (theta - elementTheta) * delta);
      }
      return {
        theta: interpolatedTheta,
        rho: (this.rho - element.rho) * delta + element.rho
      };
    }
  };
  __publicField(_Polar, "KER", new _Polar(0, 0));
  var Polar = _Polar;
  var _Complex = class _Complex {
    constructor(x, y) {
      __publicField(this, "x");
      __publicField(this, "y");
      this.x = x || 0;
      this.y = y || 0;
    }
    getc(_simple) {
      return this;
    }
    getp(simple = false) {
      return this.toPolar(simple);
    }
    set(value) {
      const cartesian = value.getc(true);
      this.x = cartesian.x;
      this.y = cartesian.y;
    }
    setc(x, y) {
      this.x = x;
      this.y = y;
    }
    setp(theta, rho) {
      this.x = Math.cos(theta) * rho;
      this.y = Math.sin(theta) * rho;
    }
    clone() {
      return new _Complex(this.x, this.y);
    }
    toPolar(simple = false) {
      const rho = this.norm();
      let theta = Math.atan2(this.y, this.x);
      if (theta < 0) {
        theta += Math.PI * 2;
      }
      return simple ? { theta, rho } : new Polar(theta, rho);
    }
    norm() {
      return Math.sqrt(this.squaredNorm());
    }
    squaredNorm() {
      return this.x * this.x + this.y * this.y;
    }
    add(position) {
      return new _Complex(this.x + position.x, this.y + position.y);
    }
    prod(position) {
      return new _Complex(this.x * position.x - this.y * position.y, this.y * position.x + this.x * position.y);
    }
    conjugate() {
      return new _Complex(this.x, -this.y);
    }
    scale(factor) {
      return new _Complex(this.x * factor, this.y * factor);
    }
    /**
     * Translate this point inside the unit disk. The argument mutation is an
     * intentional JIT 2.0.1 compatibility detail; callers normally pass a
     * freshly scaled vector.
     */
    moebiusTransformation(vector) {
      const numerator = this.add(vector);
      const denominator = vector.$conjugate().$prod(this);
      denominator.x += 1;
      return numerator.$div(denominator);
    }
    equals(position) {
      return this.x == position.x && this.y == position.y;
    }
    $add(position) {
      this.x += position.x;
      this.y += position.y;
      return this;
    }
    $prod(position) {
      const x = this.x;
      const y = this.y;
      this.x = x * position.x - y * position.y;
      this.y = y * position.x + x * position.y;
      return this;
    }
    $conjugate() {
      this.y = -this.y;
      return this;
    }
    $scale(factor) {
      this.x *= factor;
      this.y *= factor;
      return this;
    }
    $div(position) {
      const x = this.x;
      const y = this.y;
      const squaredNorm = position.squaredNorm();
      this.x = x * position.x + y * position.y;
      this.y = y * position.x - x * position.y;
      return this.$scale(1 / squaredNorm);
    }
    isZero() {
      const almostZero = 1e-4;
      return Math.abs(this.x) < almostZero && Math.abs(this.y) < almostZero;
    }
  };
  __publicField(_Complex, "KER", new _Complex(0, 0));
  var Complex = _Complex;

  // dist/graph/graph.js
  var GraphElementAccessors = class {
    dataForPhase(type) {
      const phase = type || "current";
      let data;
      if (phase === "current") {
        data = this.data;
      } else if (phase === "start") {
        data = this.startData;
      } else if (phase === "end") {
        data = this.endData;
      }
      return data;
    }
    getDataInternal(prefix, property, type, force, prefixConfig) {
      const data = this.dataForPhase(type);
      const normalizedPrefix = `$${prefix ? `${prefix}-` : ""}`;
      const dataKey = `${normalizedPrefix}${property}`;
      if (force) {
        return data[dataKey];
      }
      if (!this.Config.overridable) {
        return prefixConfig[property] || 0;
      }
      return dataKey in data ? data[dataKey] : dataKey in this.data ? this.data[dataKey] : prefixConfig[property] || 0;
    }
    setDataInternal(prefix, property, value, type) {
      const data = this.dataForPhase(type);
      const normalizedPrefix = `$${prefix ? `${prefix}-` : ""}`;
      data[`${normalizedPrefix}${property}`] = value;
    }
    removeDataInternal(prefix, properties) {
      const normalizedPrefix = `$${prefix ? `${prefix}-` : ""}`;
      for (const property of properties) {
        const dataKey = `${normalizedPrefix}${property}`;
        delete this.data[dataKey];
        delete this.startData[dataKey];
        delete this.endData[dataKey];
      }
    }
    setValues(setter, types, values) {
      const phases = splat(types);
      for (const property in values) {
        const propertyValues = splat(values[property]);
        for (let index = 0; index < phases.length; index += 1) {
          setter(property, propertyValues[index], phases[index]);
        }
      }
    }
    getData(property, type, force) {
      return this.getDataInternal("", property, type, force, this.Config);
    }
    setData(property, value, type) {
      this.setDataInternal("", property, value, type);
    }
    setDataset(types, values) {
      this.setValues(this.setData.bind(this), types, values);
    }
    removeData(...properties) {
      this.removeDataInternal("", properties);
    }
    getCanvasStyle(property, type, force) {
      return this.getDataInternal("canvas", property, type, force, this.Config.CanvasStyles);
    }
    setCanvasStyle(property, value, type) {
      this.setDataInternal("canvas", property, value, type);
    }
    setCanvasStyles(types, values) {
      this.setValues(this.setCanvasStyle.bind(this), types, values);
    }
    removeCanvasStyle(...properties) {
      this.removeDataInternal("canvas", properties);
    }
    getLabelData(property, type, force) {
      return this.getDataInternal("label", property, type, force, this.Label);
    }
    setLabelData(property, value, type) {
      this.setDataInternal("label", property, value, type);
    }
    setLabelDataset(types, values) {
      this.setValues(this.setLabelData.bind(this), types, values);
    }
    removeLabelData(...properties) {
      this.removeDataInternal("label", properties);
    }
  };
  var GraphNode = class extends GraphElementAccessors {
    constructor(options, positionConstructor, nodeConfig, edgeConfig, labelConfig) {
      super();
      const defaults = {
        id: "",
        name: "",
        data: {},
        startData: {},
        endData: {},
        adjacencies: {},
        selected: false,
        drawn: false,
        exist: false,
        angleSpan: { begin: 0, end: 0 },
        pos: new positionConstructor(),
        startPos: new positionConstructor(),
        endPos: new positionConstructor()
      };
      extend(this, extend(defaults, options));
      this.Config = this.Node = nodeConfig;
      this.Edge = edgeConfig;
      this.Label = labelConfig;
      this.$$family = "class";
    }
    adjacentTo(node) {
      return node.id in this.adjacencies;
    }
    getAdjacency(id) {
      return this.adjacencies[id];
    }
    getPos(type = "current") {
      if (type === "current") {
        return this.pos;
      }
      if (type === "end") {
        return this.endPos;
      }
      if (type === "start") {
        return this.startPos;
      }
      return void 0;
    }
    setPos(value, type = "current") {
      const position = this.getPos(type);
      position.set(value);
    }
    eachAdjacency(action, flags) {
      graphEachAdjacency(this, action, flags);
    }
    eachLevel(levelBegin, levelEnd, action, flags) {
      graphEachLevel(this, levelBegin, levelEnd, action, flags);
    }
    eachSubgraph(action, flags) {
      graphEachSubgraph(this, action, flags);
    }
    eachSubnode(action, flags) {
      graphEachSubnode(this, action, flags);
    }
    anySubnode(condition, flags) {
      return graphAnySubnode(this, condition, flags);
    }
    getSubnodes(level, flags) {
      return graphGetSubnodes(this, level, flags);
    }
    getParents() {
      return graphGetParents(this);
    }
    isDescendantOf(id) {
      return graphIsDescendantOf(this, id);
    }
  };
  var GraphAdjacency = class extends GraphElementAccessors {
    constructor(nodeFrom, nodeTo, data, edgeConfig, labelConfig) {
      super();
      this.nodeFrom = nodeFrom;
      this.nodeTo = nodeTo;
      this.data = data || {};
      this.startData = {};
      this.endData = {};
      this.Config = this.Edge = edgeConfig;
      this.Label = labelConfig;
      this.$$family = "class";
    }
  };
  var GraphNodeList = class {
    constructor(graph) {
      __publicField(this, "graph");
      this.graph = graph;
    }
    apply(action) {
      this.graph.eachNode(action);
    }
    getData(property, type, force) {
      this.apply((node) => void node.getData(property, type, force));
    }
    setData(property, value, type) {
      this.apply((node) => node.setData(property, value, type));
    }
    setDataset(types, values) {
      this.apply((node) => node.setDataset(types, values));
    }
    removeData(...properties) {
      this.apply((node) => node.removeData(...properties));
    }
    getCanvasStyle(property, type, force) {
      this.apply((node) => void node.getCanvasStyle(property, type, force));
    }
    setCanvasStyle(property, value, type) {
      this.apply((node) => node.setCanvasStyle(property, value, type));
    }
    setCanvasStyles(types, values) {
      this.apply((node) => node.setCanvasStyles(types, values));
    }
    removeCanvasStyle(...properties) {
      this.apply((node) => node.removeCanvasStyle(...properties));
    }
    getLabelData(property, type, force) {
      this.apply((node) => void node.getLabelData(property, type, force));
    }
    setLabelData(property, value, type) {
      this.apply((node) => node.setLabelData(property, value, type));
    }
    setLabelDataset(types, values) {
      this.apply((node) => node.setLabelDataset(types, values));
    }
    removeLabelData(...properties) {
      this.apply((node) => node.removeLabelData(...properties));
    }
  };
  var Graph = class {
    constructor(options, nodeConfig, edgeConfig, labelConfig) {
      __publicField(this, "Node");
      __publicField(this, "Edge");
      __publicField(this, "Label");
      __publicField(this, "opt");
      __publicField(this, "nodes");
      __publicField(this, "edges");
      __publicField(this, "nodeList");
      __publicField(this, "$$family");
      this.Node = nodeConfig;
      this.Edge = edgeConfig;
      this.Label = labelConfig;
      this.opt = merge({
        klass: Complex,
        Node: {}
      }, options || {});
      this.nodes = {};
      this.edges = {};
      this.nodeList = new GraphNodeList(this);
      this.$$family = "class";
    }
    static get Node() {
      return GraphNode;
    }
    static get Adjacence() {
      return GraphAdjacency;
    }
    static get Util() {
      return GraphUtil;
    }
    getNode(id) {
      return graphGetNode(this, id);
    }
    /** A working explicit alias for the legacy API's documented `get` method. */
    get(id) {
      return this.getNode(id);
    }
    getByName(name) {
      for (const id in this.nodes) {
        const node = this.nodes[id];
        if (node.name == name) {
          return node;
        }
      }
      return false;
    }
    getAdjacence(id, otherId) {
      if (id in this.edges) {
        return this.edges[id]?.[otherId];
      }
      return false;
    }
    addNode(input) {
      if (!this.nodes[input.id]) {
        const adjacencies = this.edges[input.id] = {};
        const options = extend({
          id: input.id,
          name: input.name,
          data: merge(input.data || {}, {}),
          adjacencies
        }, this.opt.Node);
        this.nodes[input.id] = new GraphNode(options, this.opt.klass, this.Node, this.Edge, this.Label);
      }
      return this.nodes[input.id];
    }
    addAdjacence(input, otherInput, data) {
      if (!this.hasNode(input.id)) {
        this.addNode(input);
      }
      if (!this.hasNode(otherInput.id)) {
        this.addNode(otherInput);
      }
      const node = this.nodes[input.id];
      const otherNode = this.nodes[otherInput.id];
      if (!node.adjacentTo(otherNode)) {
        const adjacencies = this.edges[input.id] = this.edges[input.id] || {};
        const otherAdjacencies = this.edges[otherInput.id] = this.edges[otherInput.id] || {};
        const adjacency = new GraphAdjacency(node, otherNode, data, this.Edge, this.Label);
        otherAdjacencies[input.id] = adjacency;
        adjacencies[otherInput.id] = adjacency;
        return adjacency;
      }
      return this.edges[input.id]?.[otherInput.id];
    }
    removeNode(id) {
      if (this.hasNode(id)) {
        delete this.nodes[id];
        const adjacencies = this.edges[id];
        for (const otherId in adjacencies) {
          delete this.edges[otherId][id];
        }
        delete this.edges[id];
      }
    }
    removeAdjacence(id, otherId) {
      delete this.edges[id][otherId];
      delete this.edges[otherId][id];
    }
    hasNode(id) {
      return id in this.nodes;
    }
    empty() {
      this.nodes = {};
      this.edges = {};
    }
    eachNode(action, flags) {
      graphEachNode(this, action, flags);
    }
    each(action, flags) {
      graphEachNode(this, action, flags);
    }
    computeLevels(id, startDepth, flags) {
      graphComputeLevels(this, id, startDepth, flags);
    }
    eachBFS(id, action, flags) {
      graphEachBFS(this, id, action, flags);
    }
    clean() {
      graphClean(this);
    }
    getClosestNodeToOrigin(property, flags) {
      return graphGetClosestNodeToOrigin(this, property, flags);
    }
    getClosestNodeToPos(position, property, flags) {
      return graphGetClosestNodeToPos(this, position, property, flags);
    }
  };
  function graphFilter(parameter) {
    if (!parameter || typeOf(parameter) !== "string") {
      return () => true;
    }
    const properties = parameter.split(" ");
    return (element) => {
      for (const property of properties) {
        if (element[property]) {
          return false;
        }
      }
      return true;
    };
  }
  function graphGetNode(graph, id) {
    return graph.nodes[id];
  }
  function graphEachNode(graph, action, flags) {
    const filter = graphFilter(flags);
    for (const id in graph.nodes) {
      const node = graph.nodes[id];
      if (filter(node)) {
        action(node);
      }
    }
  }
  function graphEachAdjacency(node, action, flags) {
    const filter = graphFilter(flags);
    for (const id in node.adjacencies) {
      const adjacency = node.adjacencies[id];
      if (filter(adjacency)) {
        if (adjacency.nodeFrom != node) {
          const previousFrom = adjacency.nodeFrom;
          adjacency.nodeFrom = adjacency.nodeTo;
          adjacency.nodeTo = previousFrom;
        }
        action(adjacency, id);
      }
    }
  }
  function graphComputeLevels(graph, id, initialDepth, flags) {
    const startDepth = initialDepth || 0;
    const filter = graphFilter(flags);
    graphEachNode(graph, (node) => {
      node._flag = false;
      node._depth = -1;
    }, flags);
    const root = graph.getNode(id);
    root._depth = startDepth;
    const queue = [root];
    while (queue.length !== 0) {
      const node = queue.pop();
      node._flag = true;
      graphEachAdjacency(node, (adjacency) => {
        const adjacentNode = adjacency.nodeTo;
        if (adjacentNode._flag == false && filter(adjacentNode)) {
          if (adjacentNode._depth < 0) {
            adjacentNode._depth = node._depth + 1 + startDepth;
          }
          queue.unshift(adjacentNode);
        }
      }, flags);
    }
  }
  function graphEachBFS(graph, id, action, flags) {
    const filter = graphFilter(flags);
    graphClean(graph);
    const queue = [
      graph.getNode(id)
    ];
    while (queue.length !== 0) {
      const node = queue.pop();
      node._flag = true;
      action(node, node._depth);
      graphEachAdjacency(node, (adjacency) => {
        const adjacentNode = adjacency.nodeTo;
        if (adjacentNode._flag == false && filter(adjacentNode)) {
          adjacentNode._flag = true;
          queue.unshift(adjacentNode);
        }
      }, flags);
    }
  }
  function graphEachLevel(node, levelBegin, requestedLevelEnd, action, flags) {
    const initialDepth = node._depth;
    const filter = graphFilter(flags);
    const levelEnd = requestedLevelEnd === false ? Number.MAX_VALUE - initialDepth : requestedLevelEnd;
    const visit = (current, begin, end) => {
      const depth = current._depth;
      if (depth >= begin && depth <= end && filter(current)) {
        action(current, depth);
      }
      if (depth < end) {
        graphEachAdjacency(current, (adjacency) => {
          const adjacentNode = adjacency.nodeTo;
          if (adjacentNode._depth > depth) {
            visit(adjacentNode, begin, end);
          }
        });
      }
    };
    visit(node, levelBegin + initialDepth, levelEnd + initialDepth);
  }
  function graphEachSubgraph(node, action, flags) {
    graphEachLevel(node, 0, false, action, flags);
  }
  function graphEachSubnode(node, action, flags) {
    graphEachLevel(node, 1, 1, action, flags);
  }
  function graphAnySubnode(node, condition, flags) {
    let found = false;
    const normalizedCondition = condition || (() => true);
    const predicate = typeOf(normalizedCondition) === "string" ? (candidate) => candidate[normalizedCondition] : normalizedCondition;
    graphEachSubnode(node, (candidate) => {
      if (predicate(candidate)) {
        found = true;
      }
    }, flags);
    return found;
  }
  function graphGetSubnodes(node, requestedLevel, flags) {
    const result = [];
    const level = requestedLevel || 0;
    let levelStart;
    let levelEnd;
    if (typeOf(level) === "array") {
      const range = level;
      levelStart = range[0];
      levelEnd = range[1];
    } else {
      levelStart = level;
      levelEnd = Number.MAX_VALUE - node._depth;
    }
    graphEachLevel(node, levelStart, levelEnd, (candidate) => result.push(candidate), flags);
    return result;
  }
  function graphGetParents(node) {
    const result = [];
    graphEachAdjacency(node, (adjacency) => {
      const parent = adjacency.nodeTo;
      if (parent._depth < node._depth) {
        result.push(parent);
      }
    });
    return result;
  }
  function graphIsDescendantOf(node, id) {
    if (node.id == id) {
      return true;
    }
    const parents = graphGetParents(node);
    let result = false;
    for (let index = 0; !result && index < parents.length; index += 1) {
      result = result || graphIsDescendantOf(parents[index], id);
    }
    return result;
  }
  function graphClean(graph) {
    graphEachNode(graph, (node) => {
      node._flag = false;
    });
  }
  function graphGetClosestNodeToOrigin(graph, property, flags) {
    return graphGetClosestNodeToPos(graph, Polar.KER, property, flags);
  }
  function graphGetClosestNodeToPos(graph, requestedPosition, requestedProperty, flags) {
    let closest = null;
    const property = requestedProperty || "current";
    const position = requestedPosition && requestedPosition.getc(true) || Complex.KER;
    const distance = (left, right) => {
      const x = left.x - right.x;
      const y = left.y - right.y;
      return x * x + y * y;
    };
    graphEachNode(graph, (node) => {
      const nodePosition = node.getPos(property).getc(true);
      if (closest === null || distance(nodePosition, position) < distance(closest.getPos(property).getc(true), position)) {
        closest = node;
      }
    }, flags);
    return closest;
  }
  var GraphUtil = {
    filter: graphFilter,
    getNode: graphGetNode,
    eachNode: graphEachNode,
    each: graphEachNode,
    eachAdjacency: graphEachAdjacency,
    computeLevels: graphComputeLevels,
    eachBFS: graphEachBFS,
    eachLevel: graphEachLevel,
    eachSubgraph: graphEachSubgraph,
    eachSubnode: graphEachSubnode,
    anySubnode: graphAnySubnode,
    getSubnodes: graphGetSubnodes,
    getParents: graphGetParents,
    isDescendantOf: graphIsDescendantOf,
    clean: graphClean,
    getClosestNodeToOrigin: graphGetClosestNodeToOrigin,
    getClosestNodeToPos: graphGetClosestNodeToPos
  };

  // dist/graph/operations/sum.js
  function sumIntoGraph(target, incoming) {
    incoming.eachNode((node) => {
      node.eachAdjacency((adjacency) => {
        target.addAdjacence(adjacency.nodeFrom, adjacency.nodeTo, adjacency.data);
      });
    });
  }

  // dist/graph/plot-animation.js
  function animatePlot(dependencies, options, versor) {
    const modes = dependencies.prepare(options.modes);
    const onComplete = options.onComplete ?? (() => {
    });
    let animating = false;
    if (options.hideLabels) {
      dependencies.setLabelsHidden?.(true);
    }
    dependencies.animation.setOptions({
      ...options,
      $animating: false,
      compute(delta) {
        dependencies.eachNode((node) => {
          for (const mode in modes) {
            dependencies.interpolate(mode, node, modes[mode], delta, versor);
          }
        });
        dependencies.plot(options, animating, delta);
        animating = true;
      },
      complete() {
        if (options.hideLabels) {
          dependencies.setLabelsHidden?.(false);
        }
        dependencies.plot(options);
        onComplete();
      }
    }).start();
    return dependencies.animation;
  }

  // dist/graph/plot-preparation.js
  function normalizePlotModes(modes) {
    const normalized = {};
    if (Array.isArray(modes)) {
      for (const mode of modes) {
        const parts = mode.split(":");
        const name = parts.shift();
        normalized[name] = parts;
      }
      return normalized;
    }
    const objectModes = modes;
    for (const name in objectModes) {
      const value = objectModes[name];
      if (name === "position") {
        normalized[value] = [];
      } else {
        normalized[name] = Array.isArray(value) ? value : [value];
      }
    }
    return normalized;
  }
  function prepareGraphForAnimation(graph, modes) {
    const normalized = normalizePlotModes(modes);
    graph.eachNode((node) => {
      node.startPos.set(node.pos);
      for (const property of normalized["node-property"] ?? []) {
        node.setData(property, node.getData(property), "start");
      }
      for (const property of normalized["node-style"] ?? []) {
        node.setCanvasStyle(property, node.getCanvasStyle(property), "start");
      }
      const edgeProperties = normalized["edge-property"];
      const edgeStyles = normalized["edge-style"];
      if (edgeProperties || edgeStyles) {
        node.eachAdjacency((adjacency) => {
          for (const property of edgeProperties ?? []) {
            adjacency.setData(property, adjacency.getData(property), "start");
          }
          for (const property of edgeStyles ?? []) {
            adjacency.setCanvasStyle(property, adjacency.getCanvasStyle(property), "start");
          }
        });
      }
    });
    return normalized;
  }

  // dist/graph/plot-tree.js
  function plotTree(dependencies, node, options, animating) {
    dependencies.canvas.getCtx();
    const nodeAlpha = node.getData("alpha");
    node.eachSubnode((child) => {
      if (options.plotSubtree(node, child) && child.exist && child.drawn) {
        const edge = node.getAdjacency(child.id);
        if (!animating) {
          options.onBeforePlotLine(edge);
        }
        dependencies.renderEdge(edge, dependencies.canvas, animating);
        if (!animating) {
          options.onAfterPlotLine(edge);
        }
        plotTree(dependencies, child, options, animating);
      }
    });
    if (node.drawn) {
      if (!animating) {
        options.onBeforePlotNode(node);
      }
      dependencies.renderNode(node, dependencies.canvas, animating);
      if (!animating) {
        options.onAfterPlotNode(node);
      }
      if (!options.hideLabels && options.withLabels && nodeAlpha >= 0.95) {
        dependencies.labels.plotLabel(dependencies.canvas, node, options);
      } else {
        dependencies.labels.hideLabel(node, false);
      }
    } else {
      dependencies.labels.hideLabel(node, true);
    }
  }

  // dist/graph/rendering/elements.js
  function renderNodeElement(node, canvas2, canvasStyles, render, animating) {
    const type = node.getData("type");
    if (type == "none") {
      return;
    }
    const context = canvas2.getCtx();
    context.save();
    context.lineWidth = node.getData("lineWidth");
    const color = node.getData("color");
    context.strokeStyle = color;
    context.fillStyle = color;
    context.globalAlpha = node.getData("alpha");
    for (const property in canvasStyles) {
      context[property] = node.getCanvasStyle(property);
    }
    render(type, node, canvas2, animating);
    context.restore();
  }
  function renderEdgeElement(edge, canvas2, canvasStyles, render, animating) {
    const type = edge.getData("type");
    if (type == "none") {
      return;
    }
    const context = canvas2.getCtx();
    context.save();
    context.lineWidth = edge.getData("lineWidth");
    const color = edge.getData("color");
    context.strokeStyle = color;
    context.fillStyle = color;
    context.globalAlpha = Math.min(edge.nodeFrom.getData("alpha"), edge.nodeTo.getData("alpha"), edge.getData("alpha"));
    for (const property in canvasStyles) {
      context[property] = edge.getCanvasStyle(property);
    }
    render(type, edge, canvas2, animating);
    context.restore();
  }

  // dist/loader/loader.js
  function toNodeInput(node) {
    return {
      id: node.id,
      name: node.name,
      ...node.data === void 0 ? {} : { data: node.data }
    };
  }
  function addTree(graph, node) {
    const input = toNodeInput(node);
    graph.addNode(input);
    if (!node.children) {
      return;
    }
    for (const child of node.children) {
      graph.addAdjacence(input, toNodeInput(child));
      addTree(graph, child);
    }
  }
  function findGraphNode(graph, json, id) {
    for (const node of json) {
      if (node.id == id) {
        return toNodeInput(node);
      }
    }
    const generated = { id, name: id };
    graph.addNode(generated);
    return generated;
  }
  function adjacencyTarget(adjacency) {
    if (typeof adjacency === "string") {
      return { id: adjacency, data: {} };
    }
    return {
      id: adjacency.nodeTo,
      data: merge(adjacency.data || {}, {})
    };
  }
  function constructGraph(json, options = {}) {
    const graph = new Graph(options.graph, options.node, options.edge, options.label);
    if (!Array.isArray(json)) {
      addTree(graph, json);
      return graph;
    }
    for (const node of json) {
      const input = toNodeInput(node);
      graph.addNode(input);
      for (const adjacency of node.adjacencies || []) {
        const target = adjacencyTarget(adjacency);
        graph.addAdjacence(input, findGraphNode(graph, json, target.id), target.data);
      }
    }
    return graph;
  }
  function graphToTreeJson(graph, rootId) {
    const root = graph.getNode(rootId);
    if (!root) {
      throw new Error(`Unknown graph root: ${rootId}`);
    }
    const serialize = (node) => {
      const children = [];
      node.eachSubnode((child) => {
        children.push(serialize(child));
      });
      return {
        id: node.id,
        name: node.name,
        data: node.data,
        children
      };
    };
    return serialize(root);
  }
  function graphToGraphJson(graph, rootId) {
    const root = graph.getNode(rootId);
    if (!root) {
      throw new Error(`Unknown graph root: ${rootId}`);
    }
    const output = [];
    const visitedState = Boolean(root.visited);
    graph.eachNode((node) => {
      const adjacencies = [];
      node.eachAdjacency((adjacency) => {
        if (Boolean(adjacency.nodeTo.visited) === visitedState) {
          adjacencies.push({
            nodeTo: adjacency.nodeTo.id,
            data: adjacency.data
          });
        }
      });
      output.push({
        id: node.id,
        name: node.name,
        data: node.data,
        adjacencies
      });
      node.visited = !visitedState;
    });
    return output;
  }

  // dist/visualizations/treemap.js
  var TreemapVisualization = class {
    constructor(dependencies) {
      __publicField(this, "canvas");
      __publicField(this, "config");
      __publicField(this, "labels");
      __publicField(this, "animation");
      __publicField(this, "renderNode");
      __publicField(this, "renderEdge");
      __publicField(this, "createLayoutEngine");
      __publicField(this, "interpolate");
      __publicField(this, "events");
      __publicField(this, "graph");
      __publicField(this, "root", "");
      __publicField(this, "json");
      __publicField(this, "clickedNode", null);
      __publicField(this, "busy", false);
      __publicField(this, "orientation");
      this.canvas = dependencies.canvas;
      this.config = dependencies.config;
      this.labels = dependencies.labels;
      this.animation = dependencies.animation ?? new Animation();
      this.renderNode = dependencies.renderNode;
      this.renderEdge = dependencies.renderEdge;
      this.createLayoutEngine = dependencies.createLayout;
      this.interpolate = dependencies.interpolate;
      this.events = dependencies.events;
      this.orientation = dependencies.config.orientation ?? "h";
      this.graph = this.createGraph();
    }
    loadJSON(json, index) {
      this.json = json;
      this.labels.clearLabels?.(true);
      this.graph = constructGraph(json, this.constructionOptions());
      this.root = Array.isArray(json) ? json[index ? index : 0].id : json.id;
      this.clickedNode = null;
      this.busy = false;
    }
    horizontal() {
      return this.orientation === "h";
    }
    vertical() {
      return this.orientation === "v";
    }
    changeOrientation() {
      this.orientation = this.vertical() ? "h" : "v";
    }
    refresh() {
      this.ensureLoaded();
      if (this.busy) {
        return false;
      }
      this.busy = true;
      if (this.config.animate) {
        this.compute("end");
        if ((this.config.levelsToShow ?? 0) > 0) {
          this.setRightLevelToShow(this.selectedRoot());
        }
        this.animate({
          modes: this.geometryModes(),
          onComplete: () => {
            this.busy = false;
          }
        });
        return true;
      }
      if (this.config.Label.type != "Native") {
        this.graph.eachNode((node) => this.labels.hideLabel(node, false));
      }
      this.busy = false;
      this.compute();
      if ((this.config.levelsToShow ?? 0) > 0) {
        this.setRightLevelToShow(this.selectedRoot());
      }
      this.plot();
      return true;
    }
    reposition() {
      this.compute("end");
    }
    geometryModes() {
      return ["linear", "node-property:width:height"];
    }
    compute(property = "current") {
      this.ensureLoaded();
      const layout = this.createLayoutEngine({
        graph: this.graph,
        root: this.root,
        getSize: () => this.canvas.getSize(),
        config: { ...this.config, orientation: this.orientation },
        controller: {
          onBeforeCompute: (root) => this.config.onBeforeCompute(root),
          onAfterCompute: (root) => this.config.onAfterCompute(root)
        },
        clickedNode: this.clickedNode
      });
      layout.compute(property);
      this.orientation = layout.orientation;
    }
    plot(options = this.config, animating) {
      this.ensureLoaded();
      const root = this.selectedRoot();
      const treeOptions = {
        ...this.config,
        ...options,
        withLabels: true,
        hideLabels: false,
        plotSubtree: (node) => node.anySubnode("exist")
      };
      this.canvas.clear();
      plotTree({
        canvas: this.canvas,
        labels: this.labels,
        renderNode: (node, canvas2, active) => {
          renderNodeElement(node, canvas2, this.config.Node.CanvasStyles, (type, candidate, target, rendering) => this.renderNode(type, candidate, target, rendering, this.config, (value) => this.leaf(value), this.clickedNode), active);
        },
        renderEdge: (edge, canvas2, active) => {
          renderEdgeElement(edge, canvas2, this.config.Edge.CanvasStyles, this.renderEdge, active);
        }
      }, root, treeOptions, animating);
    }
    animate(requestedOptions = {}) {
      this.ensureLoaded();
      const options = merge(this.config, { modes: this.geometryModes() }, requestedOptions);
      return animatePlot({
        animation: this.animation,
        prepare: (modes) => prepareGraphForAnimation(this.graph, modes),
        eachNode: (visit) => this.graph.eachNode(visit),
        interpolate: (mode, node, properties, delta) => {
          if (!this.interpolate) {
            throw new TypeError(`No Treemap interpolator was supplied for mode: ${mode}`);
          }
          this.interpolate(mode, node, properties, delta);
        },
        plot: (plotOptions, active) => this.plot(plotOptions, active),
        setLabelsHidden: (hidden) => this.labels.hideLabels(hidden)
      }, options);
    }
    leaf(node) {
      return node.getSubnodes([1, 1], "ignore").length === 0;
    }
    setRightLevelToShow(node) {
      const level = this.config.levelsToShow ?? 0;
      node.eachLevel(0, level + 1, (candidate) => {
        const depth = candidate._depth - node._depth;
        if (depth > level) {
          candidate.drawn = false;
          candidate.exist = false;
          candidate.ignore = true;
          this.labels.hideLabel(candidate, false);
        } else {
          candidate.drawn = true;
          candidate.exist = true;
          delete candidate.ignore;
        }
      });
      node.drawn = true;
      delete node.ignore;
    }
    enter(node) {
      this.ensureLoaded();
      if (this.busy || this.graph.getNode(node.id) !== node) {
        return false;
      }
      this.busy = true;
      const previousClickedNode = this.clickedNode;
      const complete = () => {
        if ((this.config.levelsToShow ?? 0) > 0) {
          this.setRightLevelToShow(node);
        }
        if ((this.config.levelsToShow ?? 0) > 0 || this.config.request) {
          this.compute();
        }
        if (!this.config.animate) {
          this.busy = false;
          this.clickedNode = node;
          this.refresh();
          return;
        }
        this.graph.nodeList.setData("alpha", 0, "end");
        node.eachSubgraph((candidate) => {
          candidate.setData("alpha", 1, "end");
        }, "ignore");
        this.animate({
          duration: 500,
          modes: ["node-property:alpha"],
          onComplete: () => {
            this.clickedNode = node;
            this.compute("end");
            this.clickedNode = previousClickedNode;
            this.animate({
              duration: 1e3,
              modes: this.geometryModes(),
              onComplete: () => {
                this.busy = false;
                this.clickedNode = node;
              }
            });
          }
        });
      };
      if (this.config.request) {
        this.requestNodes(node, complete);
      } else {
        complete();
      }
      return true;
    }
    out() {
      this.ensureLoaded();
      if (this.busy) {
        return false;
      }
      this.busy = true;
      if (this.events) {
        this.events.hoveredNode = false;
      }
      const previousClickedNode = this.clickedNode;
      const parent = this.selectedRoot().getParents()[0];
      if (!parent) {
        this.busy = false;
        return false;
      }
      const complete = () => {
        this.clickedNode = parent;
        if (this.config.request) {
          this.requestNodes(parent, () => {
            this.compute();
            this.plot();
            this.busy = false;
          });
        } else {
          this.compute();
          this.plot();
          this.busy = false;
        }
      };
      if ((this.config.levelsToShow ?? 0) > 0) {
        this.setRightLevelToShow(parent);
      }
      if (!this.config.animate) {
        complete();
        return true;
      }
      this.clickedNode = parent;
      this.compute("end");
      this.clickedNode = previousClickedNode;
      this.animate({
        duration: 1e3,
        modes: this.geometryModes(),
        onComplete: () => {
          this.clickedNode = parent;
          this.graph.eachNode((node) => {
            node.setDataset(["current", "end"], { alpha: [0, 1] });
          }, "ignore");
          previousClickedNode?.eachSubgraph((node) => {
            node.setData("alpha", 1);
          }, "ignore");
          this.animate({
            duration: 500,
            modes: ["node-property:alpha"],
            onComplete: complete
          });
        }
      });
      return true;
    }
    requestNodes(node, onComplete) {
      const request = this.config.request;
      if (!request) {
        onComplete();
        return;
      }
      const levels = this.config.levelsToShow ?? 0;
      const leaves = [];
      const depth = node._depth;
      node.eachLevel(0, levels, (candidate) => {
        const nodeLevel = levels - (candidate._depth - depth);
        if (candidate.drawn && !candidate.anySubnode() && nodeLevel > 0) {
          leaves.push(candidate);
          candidate._level = nodeLevel;
        }
      });
      if (leaves.length === 0) {
        onComplete();
        return;
      }
      let completed = 0;
      for (const leaf of leaves) {
        request(leaf.id, leaf._level, {
          onComplete: (nodeId, data) => {
            if (data?.children) {
              const incoming = {
                ...data,
                id: nodeId
              };
              const graph = constructGraph(incoming, this.constructionOptions());
              sumIntoGraph(this.graph, graph);
            }
            completed += 1;
            if (completed === leaves.length) {
              this.graph.computeLevels(this.root, 0);
              onComplete();
            }
          }
        });
      }
    }
    toJSON(type = "tree") {
      this.ensureLoaded();
      return type === "tree" ? graphToTreeJson(this.graph, this.root) : graphToGraphJson(this.graph, this.root);
    }
    selectedRoot() {
      return this.clickedNode ?? this.requireNode(this.root);
    }
    createGraph() {
      return new Graph(this.constructionOptions().graph, this.config.Node, this.config.Edge, this.config.Label);
    }
    constructionOptions() {
      return {
        graph: {
          klass: Complex,
          Node: { selected: false, exist: true, drawn: true }
        },
        node: this.config.Node,
        edge: this.config.Edge,
        label: this.config.Label
      };
    }
    requireNode(id) {
      const node = this.graph.getNode(id);
      if (!node) {
        throw new Error(`Unknown graph node: ${id}`);
      }
      return node;
    }
    ensureLoaded() {
      if (!this.root || !this.graph.getNode(this.root)) {
        throw new Error("No graph data has been loaded");
      }
    }
  };

  // dist/visualizations/treemap-slice-and-dice.js
  var SliceAndDiceTreemapVisualization = class extends TreemapVisualization {
    constructor(dependencies) {
      super({
        ...dependencies,
        createLayout: (options) => new SliceAndDiceTreemapLayout(options)
      });
    }
  };

  // dist/layouts/treemap/area.js
  function worstAspectRatio(children, fixedDimension) {
    if (!children || children.length === 0) {
      return Number.MAX_VALUE;
    }
    let areaSum = 0;
    let maximumArea = 0;
    let minimumArea = Number.MAX_VALUE;
    for (const child of children) {
      const area = child._area;
      areaSum += area;
      minimumArea = minimumArea < area ? minimumArea : area;
      maximumArea = maximumArea > area ? maximumArea : area;
    }
    const squaredDimension = fixedDimension * fixedDimension;
    const squaredAreaSum = areaSum * areaSum;
    return Math.max(squaredDimension * maximumArea / squaredAreaSum, squaredAreaSum / (squaredDimension * minimumArea));
  }
  function averageAspectRatio(children, fixedDimension) {
    if (!children || children.length === 0) {
      return Number.MAX_VALUE;
    }
    let aspectRatioSum = 0;
    for (const child of children) {
      const area = child._area;
      const otherDimension = area / fixedDimension;
      aspectRatioSum += fixedDimension > otherDimension ? fixedDimension / otherDimension : otherDimension / fixedDimension;
    }
    return aspectRatioSum / children.length;
  }
  var AreaTreemapLayout = class {
    constructor(dependencies) {
      __publicField(this, "graph");
      __publicField(this, "root");
      __publicField(this, "getSize");
      __publicField(this, "config");
      __publicField(this, "controller");
      __publicField(this, "clickedNode");
      __publicField(this, "orientation");
      this.graph = dependencies.graph;
      this.root = dependencies.root;
      this.getSize = dependencies.getSize;
      this.controller = dependencies.controller || {
        onBeforeCompute: () => {
        },
        onAfterCompute: () => {
        }
      };
      this.clickedNode = dependencies.clickedNode ?? null;
      const config2 = dependencies.config || {};
      this.config = {
        ...config2,
        orientation: config2.orientation ?? "h",
        titleHeight: config2.titleHeight ?? 13,
        offset: config2.offset ?? 2
      };
      this.orientation = this.config.orientation;
    }
    horizontal() {
      return this.orientation === "h";
    }
    vertical() {
      return this.orientation === "v";
    }
    changeOrientation() {
      this.orientation = this.vertical() ? "h" : "v";
    }
    compute(property = "current") {
      const root = this.requireNode(this.clickedNode?.id || this.root);
      this.controller.onBeforeCompute(root);
      const { width, height } = this.getSize();
      const offsetWidth = width - this.config.offset;
      const offsetHeight = height - this.config.offset;
      this.graph.computeLevels(this.root, 0, "ignore");
      root.getPos(property).setc(-width / 2, -height / 2);
      root.setData("width", width, property);
      root.setData("height", height, property);
      this.computePositions(root, {
        top: -height / 2 + this.config.titleHeight,
        left: -width / 2,
        width: offsetWidth,
        height: offsetHeight - this.config.titleHeight
      }, property);
      this.controller.onAfterCompute(root);
    }
    /** Recursively groups siblings into rows using the supplied score. */
    computeDimension(tail, initialElements, fixedDimension, coordinates, compare, property) {
      if (tail.length + initialElements.length === 1) {
        const finalElements = tail.length === 1 ? tail : initialElements;
        this.layoutLast(finalElements, fixedDimension, coordinates, property);
        return;
      }
      if (tail.length >= 2 && initialElements.length === 0) {
        initialElements = [tail.shift()];
      }
      if (tail.length === 0) {
        if (initialElements.length > 0) {
          this.layoutRow(initialElements, fixedDimension, coordinates, property);
        }
        return;
      }
      const candidate = tail[0];
      if (compare(initialElements, fixedDimension) >= compare([candidate].concat(initialElements), fixedDimension)) {
        this.computeDimension(tail.slice(1), initialElements.concat([candidate]), fixedDimension, coordinates, compare, property);
        return;
      }
      const newCoordinates = this.layoutRow(initialElements, fixedDimension, coordinates, property);
      this.computeDimension(tail, [], newCoordinates.dim, newCoordinates, compare, property);
    }
    layoutLast(children, _fixedDimension, coordinates, property) {
      const child = children[0];
      child.getPos(property).setc(coordinates.left, coordinates.top);
      child.setData("width", coordinates.width, property);
      child.setData("height", coordinates.height, property);
    }
    requireNode(id) {
      const node = this.graph.getNode(id);
      if (!node) {
        throw new Error(`Unknown graph node: ${id}`);
      }
      return node;
    }
  };

  // dist/layouts/treemap/squarified.js
  var SquarifiedTreemapLayout = class extends AreaTreemapLayout {
    computePositions(node, coordinates, property) {
      this.orientation = coordinates.width >= coordinates.height ? "h" : "v";
      const children = node.getSubnodes([1, 1], "ignore");
      if (children.length === 0) {
        return;
      }
      this.processChildrenLayout(node, children, coordinates, property);
      for (const child of children) {
        const height = Math.max(child.getData("height", property) - this.config.offset - this.config.titleHeight, 0);
        const width = Math.max(child.getData("width", property) - this.config.offset, 0);
        const position = child.getPos(property);
        this.computePositions(child, {
          width,
          height,
          top: position.y + this.config.titleHeight,
          left: position.x
        }, property);
      }
    }
    processChildrenLayout(_parent, children, coordinates, property) {
      const parentArea = coordinates.width * coordinates.height;
      const childAreas = [];
      let totalChildArea = 0;
      for (let index = 0; index < children.length; index += 1) {
        const area = parseFloat(children[index]?.getData("area", property));
        childAreas[index] = area;
        totalChildArea += area;
      }
      for (let index = 0; index < children.length; index += 1) {
        const child = children[index];
        child._area = parentArea * childAreas[index] / totalChildArea;
      }
      const minimumSide = this.horizontal() ? coordinates.height : coordinates.width;
      children.sort((left, right) => {
        const difference = right._area - left._area;
        return difference ? difference : right.id == left.id ? 0 : right.id < left.id ? 1 : -1;
      });
      this.squarify(children.slice(1), [children[0]], minimumSide, coordinates, property);
    }
    squarify(tail, initialElements, fixedDimension, coordinates, property) {
      this.computeDimension(tail, initialElements, fixedDimension, coordinates, worstAspectRatio, property);
    }
    layoutRow(children, fixedDimension, coordinates, property) {
      return this.horizontal() ? this.layoutVertical(children, fixedDimension, coordinates, property) : this.layoutHorizontal(children, fixedDimension, coordinates, property);
    }
    layoutVertical(children, fixedDimension, coordinates, property) {
      let totalArea = 0;
      for (const child of children) {
        totalArea += child._area;
      }
      const width = totalArea / fixedDimension;
      let top = 0;
      for (const child of children) {
        const height = child._area / width;
        child.getPos(property).setc(coordinates.left, coordinates.top + top);
        child.setData("width", width, property);
        child.setData("height", height, property);
        top += height;
      }
      const answer = {
        height: coordinates.height,
        width: coordinates.width - width,
        top: coordinates.top,
        left: coordinates.left + width,
        dim: Math.min(coordinates.width - width, coordinates.height)
      };
      if (answer.dim != answer.height) {
        this.changeOrientation();
      }
      return answer;
    }
    layoutHorizontal(children, fixedDimension, coordinates, property) {
      let totalArea = 0;
      for (const child of children) {
        totalArea += child._area;
      }
      const height = totalArea / fixedDimension;
      const top = coordinates.top;
      let left = 0;
      for (const child of children) {
        const width = child._area / height;
        child.getPos(property).setc(coordinates.left + left, top);
        child.setData("width", width, property);
        child.setData("height", height, property);
        left += width;
      }
      const answer = {
        height: coordinates.height - height,
        width: coordinates.width,
        top: coordinates.top + height,
        left: coordinates.left,
        dim: Math.min(coordinates.width, coordinates.height - height)
      };
      if (answer.dim != answer.width) {
        this.changeOrientation();
      }
      return answer;
    }
  };

  // dist/visualizations/treemap-squarified.js
  var SquarifiedTreemapVisualization = class extends TreemapVisualization {
    constructor(dependencies) {
      super({
        ...dependencies,
        createLayout: (options) => new SquarifiedTreemapLayout(options)
      });
    }
  };

  // dist/layouts/treemap/strip.js
  var StripTreemapLayout = class extends AreaTreemapLayout {
    computePositions(node, coordinates, property) {
      const children = node.getSubnodes([1, 1], "ignore");
      if (children.length === 0) {
        return;
      }
      this.processChildrenLayout(node, children, coordinates, property);
      for (const child of children) {
        const height = Math.max(child.getData("height", property) - this.config.offset - this.config.titleHeight, 0);
        const width = Math.max(child.getData("width", property) - this.config.offset, 0);
        const position = child.getPos(property);
        this.computePositions(child, {
          width,
          height,
          top: position.y + this.config.titleHeight,
          left: position.x
        }, property);
      }
    }
    processChildrenLayout(_parent, children, coordinates, property) {
      const parentArea = coordinates.width * coordinates.height;
      const childAreas = [];
      let totalChildArea = 0;
      for (let index = 0; index < children.length; index += 1) {
        const area = +children[index]?.getData("area", property);
        childAreas[index] = area;
        totalChildArea += area;
      }
      for (let index = 0; index < children.length; index += 1) {
        const child = children[index];
        child._area = parentArea * childAreas[index] / totalChildArea;
      }
      const side = this.horizontal() ? coordinates.width : coordinates.height;
      this.stripify(children.slice(1), [children[0]], side, coordinates, property);
    }
    stripify(tail, initialElements, fixedDimension, coordinates, property) {
      this.computeDimension(tail, initialElements, fixedDimension, coordinates, averageAspectRatio, property);
    }
    layoutRow(children, fixedDimension, coordinates, property) {
      return this.horizontal() ? this.layoutHorizontal(children, fixedDimension, coordinates, property) : this.layoutVertical(children, fixedDimension, coordinates, property);
    }
    layoutVertical(children, fixedDimension, coordinates, property) {
      let totalArea = 0;
      for (const child of children) {
        totalArea += child._area;
      }
      const width = totalArea / fixedDimension;
      let top = 0;
      for (const child of children) {
        const height = child._area / width;
        child.getPos(property).setc(coordinates.left, coordinates.top + (fixedDimension - height - top));
        child.setData("width", width, property);
        child.setData("height", height, property);
        top += height;
      }
      return {
        height: coordinates.height,
        width: coordinates.width - width,
        top: coordinates.top,
        left: coordinates.left + width,
        dim: fixedDimension
      };
    }
    layoutHorizontal(children, fixedDimension, coordinates, property) {
      let totalArea = 0;
      for (const child of children) {
        totalArea += child._area;
      }
      const height = totalArea / fixedDimension;
      const top = coordinates.height - height;
      let left = 0;
      for (const child of children) {
        const width = child._area / height;
        child.getPos(property).setc(coordinates.left + left, coordinates.top + top);
        child.setData("width", width, property);
        child.setData("height", height, property);
        left += width;
      }
      return {
        height: coordinates.height - height,
        width: coordinates.width,
        top: coordinates.top,
        left: coordinates.left,
        dim: fixedDimension
      };
    }
  };

  // dist/visualizations/treemap-strip.js
  var StripTreemapVisualization = class extends TreemapVisualization {
    constructor(dependencies) {
      super({
        ...dependencies,
        createLayout: (options) => new StripTreemapLayout(options)
      });
    }
  };

  // dist/visualizations/treemap-edge-renderers.js
  function renderTreemapNoneEdge(_type, _edge, _canvas, _animating) {
  }

  // dist/graph/rendering/node-shapes.js
  function containsRectangle(nodePosition, position, width, height) {
    return Math.abs(position.x - nodePosition.x) <= width / 2 && Math.abs(position.y - nodePosition.y) <= height / 2;
  }

  // dist/visualizations/treemap-node-renderers.js
  function cushionColor(color) {
    const values = hexToRgb(color);
    const shaded = [
      values[0] * 0.2 >> 0,
      values[1] * 0.2 >> 0,
      values[2] * 0.2 >> 0
    ];
    return rgbToHex(shaded);
  }
  function renderTreemapRectangleNode(_type, node, canvas2, _animating, config2 = {}, leaf = () => false, _clickedNode) {
    const isLeaf = leaf(node);
    const offset = config2.offset ?? 2;
    const titleHeight = config2.titleHeight ?? 13;
    const position = node.pos.getc(true);
    const width = node.getData("width");
    const height = node.getData("height");
    const border = node.getData("border");
    const context = canvas2.getCtx();
    const x = position.x + offset / 2;
    const y = position.y + offset / 2;
    if (width <= offset || height <= offset) {
      return;
    }
    if (isLeaf) {
      if (config2.cushion) {
        const gradient = context.createRadialGradient(x + (width - offset) / 2, y + (height - offset) / 2, 1, x + (width - offset) / 2, y + (height - offset) / 2, width < height ? height : width);
        const color = node.getData("color");
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, cushionColor(color));
        context.fillStyle = gradient;
      }
      context.fillRect(x, y, width - offset, height - offset);
      if (border) {
        context.save();
        context.strokeStyle = border;
        context.strokeRect(x, y, width - offset, height - offset);
        context.restore();
      }
    } else if (titleHeight > 0) {
      context.fillRect(position.x + offset / 2, position.y + offset / 2, width - offset, titleHeight - offset);
      if (border) {
        context.save();
        context.strokeStyle = border;
        context.strokeRect(position.x + offset / 2, position.y + offset / 2, width - offset, height - offset);
        context.restore();
      }
    }
  }
  function containsTreemapRectangleNode(node, position, config2 = {}, leaf = () => false, clickedNode) {
    if (clickedNode && !node.isDescendantOf(clickedNode.id) || Boolean(node.ignore)) {
      return false;
    }
    const nodePosition = node.pos.getc(true);
    const width = node.getData("width");
    const height = leaf(node) ? node.getData("height") : config2.titleHeight ?? 13;
    return containsRectangle({ x: nodePosition.x + width / 2, y: nodePosition.y + height / 2 }, position, width, height);
  }

  // examples/market-heatmap/market-data.js
  var BASE_MARKET = [
    {
      id: "technology",
      name: "\u0641\u0646\u0627\u0648\u0631\u06CC",
      color: "#17253a",
      stocks: [
        ["NVDA", "NVIDIA", 3120, 184.36, 3.84, 2214e5],
        ["MSFT", "Microsoft", 2950, 407.12, 1.28, 189e5],
        ["AAPL", "Apple", 2870, 239.54, -0.72, 512e5],
        ["AVGO", "Broadcom", 1380, 351.84, 2.16, 278e5],
        ["ORCL", "Oracle", 650, 294.18, -1.14, 132e5],
        ["CRM", "Salesforce", 255, 268.42, 0.64, 89e5]
      ]
    },
    {
      id: "communication",
      name: "\u0627\u0631\u062A\u0628\u0627\u0637\u0627\u062A",
      color: "#25203a",
      stocks: [
        ["GOOGL", "Alphabet", 2240, 183.67, 1.72, 294e5],
        ["META", "Meta Platforms", 1610, 661.12, 2.43, 176e5],
        ["NFLX", "Netflix", 515, 1187.64, -2.08, 61e5],
        ["TMUS", "T-Mobile", 284, 238.11, 0.31, 45e5]
      ]
    },
    {
      id: "consumer",
      name: "\u0645\u0635\u0631\u0641\u06CC",
      color: "#2b2330",
      stocks: [
        ["AMZN", "Amazon", 2380, 224.83, -1.62, 427e5],
        ["TSLA", "Tesla", 1510, 436.27, 4.91, 1183e5],
        ["WMT", "Walmart", 840, 103.42, 0.56, 159e5],
        ["COST", "Costco", 435, 978.55, -0.38, 26e5],
        ["HD", "Home Depot", 392, 384.16, 1.07, 38e5],
        ["MCD", "McDonald's", 218, 316.29, -0.24, 29e5]
      ]
    },
    {
      id: "financials",
      name: "\u0645\u0627\u0644\u06CC",
      color: "#1d2d32",
      stocks: [
        ["BRK.B", "Berkshire Hathaway", 1120, 520.41, 0.44, 42e5],
        ["JPM", "JPMorgan Chase", 780, 281.33, -0.91, 97e5],
        ["V", "Visa", 655, 341.82, 1.11, 59e5],
        ["MA", "Mastercard", 560, 548.12, 0.78, 31e5],
        ["BAC", "Bank of America", 385, 51.04, -1.43, 412e5]
      ]
    },
    {
      id: "healthcare",
      name: "\u0633\u0644\u0627\u0645\u062A",
      color: "#18312d",
      stocks: [
        ["LLY", "Eli Lilly", 910, 958.47, 2.76, 46e5],
        ["JNJ", "Johnson & Johnson", 405, 168.31, -0.42, 71e5],
        ["ABBV", "AbbVie", 372, 210.18, 0.92, 53e5],
        ["UNH", "UnitedHealth", 342, 378.66, -3.28, 88e5],
        ["MRK", "Merck", 236, 93.14, 0.18, 115e5]
      ]
    },
    {
      id: "energy-industrial",
      name: "\u0627\u0646\u0631\u0698\u06CC \u0648 \u0635\u0646\u0639\u062A",
      color: "#33291c",
      stocks: [
        ["XOM", "Exxon Mobil", 505, 116.27, -1.82, 173e5],
        ["CVX", "Chevron", 288, 161.74, 0.63, 79e5],
        ["GE", "GE Aerospace", 300, 279.42, 2.04, 64e5],
        ["CAT", "Caterpillar", 230, 471.26, -0.67, 23e5]
      ]
    }
  ];
  var clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
  var channel = (value) => Math.round(clamp(value, 0, 255));
  var hex = (red, green, blue) => `#${[red, green, blue].map((value) => channel(value).toString(16).padStart(2, "0")).join("")}`;
  function heatColor(change) {
    const intensity = Math.min(Math.abs(change) / 5, 1);
    if (Math.abs(change) < 0.08) return "#344052";
    if (change > 0) {
      return hex(24 - intensity * 10, 91 + intensity * 89, 69 + intensity * 31);
    }
    return hex(121 + intensity * 85, 45 - intensity * 17, 52 - intensity * 15);
  }
  function formatChange(change) {
    return `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
  }
  function formatMarketCap(value) {
    return value >= 1e3 ? `$${(value / 1e3).toFixed(2)}T` : `$${value.toFixed(0)}B`;
  }
  function buildMarketTree(market = BASE_MARKET) {
    const sectors = market.map((sector) => {
      const children = sector.stocks.map(
        ([ticker, company, marketCap, price, change, volume]) => ({
          id: `stock-${ticker.replace(".", "-").toLowerCase()}`,
          name: `${ticker}  ${formatChange(change)}`,
          data: {
            $area: marketCap,
            $color: heatColor(change),
            ticker,
            company,
            sector: sector.name,
            marketCap,
            price,
            change,
            volume
          }
        })
      );
      const area = children.reduce((sum, child) => sum + child.data.marketCap, 0);
      return {
        id: `sector-${sector.id}`,
        name: sector.name,
        data: { $area: area, $color: sector.color, sector: sector.name },
        children
      };
    });
    return {
      id: "market",
      name: "\u0628\u0627\u0632\u0627\u0631",
      data: {
        $area: sectors.reduce((sum, sector) => sum + sector.data.$area, 0),
        $color: "#111827"
      },
      children: sectors
    };
  }
  function marketSummary(market = BASE_MARKET) {
    const stocks = market.flatMap((sector) => sector.stocks);
    const totalCap = stocks.reduce((sum, stock) => sum + stock[2], 0);
    const weightedChange = stocks.reduce(
      (sum, stock) => sum + stock[2] * stock[4],
      0
    ) / totalCap;
    return {
      totalCap,
      weightedChange,
      advances: stocks.filter((stock) => stock[4] > 0.08).length,
      declines: stocks.filter((stock) => stock[4] < -0.08).length,
      unchanged: stocks.filter((stock) => Math.abs(stock[4]) <= 0.08).length
    };
  }
  function simulateMarket(market = BASE_MARKET, volatility = 1, random = Math.random) {
    return market.map((sector) => ({
      ...sector,
      stocks: sector.stocks.map((stock) => {
        const impulse = (random() + random() + random() - 1.5) * volatility;
        const nextChange = clamp(stock[4] * 0.72 + impulse, -7.5, 7.5);
        const nextPrice = Math.max(1, stock[3] * (1 + impulse / 100));
        const capDrift = 0.992 + random() * 0.016;
        const volumeDrift = 0.8 + random() * 0.4;
        return [
          stock[0],
          stock[1],
          stock[2] * capDrift,
          nextPrice,
          nextChange,
          Math.round(stock[5] * volumeDrift)
        ];
      })
    }));
  }

  // examples/market-heatmap/main.js
  var layouts = {
    squarified: SquarifiedTreemapVisualization,
    strip: StripTreemapVisualization,
    slice: SliceAndDiceTreemapVisualization
  };
  var MARKET_TICK_MS = 250;
  var MARKET_TICK_ANIMATION_MS = 180;
  var host = document.querySelector("#heatmap");
  var tooltip = document.querySelector("#tooltip");
  var detail = document.querySelector("#selection-detail");
  var breadcrumb = document.querySelector("#breadcrumb");
  var parentButton = document.querySelector("#go-parent");
  var updateButton = document.querySelector("#simulate");
  var resetButton = document.querySelector("#reset-market");
  var layoutSelect = document.querySelector("#layout");
  var timeframeSelect = document.querySelector("#timeframe");
  var visualization;
  var hoveredNode = null;
  var currentMarket = structuredClone(BASE_MARKET);
  var updating = false;
  var bridge = {
    fx: { plot: () => visualization?.plot() },
    refresh: () => visualization?.refresh()
  };
  var initialSize = () => ({
    width: Math.max(320, Math.floor(host.clientWidth)),
    height: Math.max(420, Math.floor(host.clientHeight))
  });
  var size = initialSize();
  var canvas = new Canvas(bridge, {
    injectInto: host,
    width: size.width,
    height: size.height,
    Label: { type: "Native" }
  });
  function config() {
    return {
      orientation: "h",
      titleHeight: 27,
      offset: 3,
      levelsToShow: 0,
      constrained: false,
      animate: false,
      duration: 900,
      fps: 45,
      cushion: true,
      clearCanvas: true,
      withLabels: true,
      Node: {
        type: "rectangle",
        overridable: true,
        alpha: 1,
        color: "#344052",
        lineWidth: 2,
        width: 1,
        height: 1,
        border: false,
        CanvasStyles: {}
      },
      Edge: {
        type: "none",
        overridable: true,
        alpha: 1,
        color: "#0b1120",
        lineWidth: 1,
        CanvasStyles: {}
      },
      Label: {
        type: "Native",
        size: 11,
        style: "600",
        family: "Inter, ui-sans-serif, system-ui, sans-serif",
        textAlign: "center",
        textBaseline: "middle",
        color: "#f8fafc"
      },
      onBeforeCompute() {
      },
      onAfterCompute() {
      },
      onBeforePlotLine() {
      },
      onAfterPlotLine() {
      },
      onBeforePlotNode() {
      },
      onAfterPlotNode() {
      },
      onComplete() {
      }
    };
  }
  function interpolator(mode, node, properties, delta) {
    if (mode === "linear") {
      linearPlotInterpolator(node, properties, delta);
      return;
    }
    if (mode === "node-property") {
      nodePropertyPlotInterpolator(node, properties, delta);
      return;
    }
    throw new TypeError(`Unsupported demo interpolation mode: ${mode}`);
  }
  function createVisualization(layoutName = layoutSelect.value) {
    hoveredNode = null;
    const Visualization = layouts[layoutName] ?? layouts.squarified;
    const options = config();
    const labels = new NativeLabels((surface, node) => {
      const position = node.pos.getc(true);
      const width = node.getData("width");
      const height = node.getData("height");
      const isLeaf = visualization?.leaf(node) ?? false;
      const y = isLeaf ? position.y + height / 2 : position.y + options.titleHeight / 2;
      surface.getCtx().fillText(
        node.name,
        position.x + width / 2,
        y,
        Math.max(0, width - 8)
      );
    });
    visualization = new Visualization({
      canvas,
      config: options,
      labels,
      renderNode: renderTreemapRectangleNode,
      renderEdge: renderTreemapNoneEdge,
      interpolate: interpolator
    });
    visualization.loadJSON(buildMarketTree(currentMarket));
    visualization.refresh();
    options.animate = true;
    updateSummary();
    updateBreadcrumb();
  }
  function currentRoot() {
    return visualization.clickedNode ?? visualization.graph.getNode(visualization.root);
  }
  function updateBreadcrumb(pendingName) {
    const root = currentRoot();
    const name = pendingName ?? root?.name ?? "\u0628\u0627\u0632\u0627\u0631";
    breadcrumb.textContent = name === "\u0628\u0627\u0632\u0627\u0631" ? "\u06A9\u0644 \u0628\u0627\u0632\u0627\u0631" : `\u06A9\u0644 \u0628\u0627\u0632\u0627\u0631 / ${name}`;
    parentButton.disabled = !visualization.clickedNode;
  }
  function updateSummary() {
    const summary = marketSummary(currentMarket);
    const move = document.querySelector("#market-move");
    move.textContent = formatChange(summary.weightedChange);
    move.dataset.direction = summary.weightedChange >= 0 ? "up" : "down";
    document.querySelector("#market-cap").textContent = formatMarketCap(summary.totalCap);
    document.querySelector("#advances").textContent = String(summary.advances);
    document.querySelector("#declines").textContent = String(summary.declines);
    document.querySelector("#unchanged").textContent = String(summary.unchanged);
    document.querySelector("#last-update").textContent = new Intl.DateTimeFormat("fa-IR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(/* @__PURE__ */ new Date());
  }
  function canvasPoint(event) {
    const rect = canvas.canvases[0].canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left - rect.width / 2,
      y: event.clientY - rect.top - rect.height / 2
    };
  }
  function nodeAt(point) {
    const nodes = Object.values(visualization.graph.nodes).filter((node) => node.drawn && node.getData("alpha") >= 0.95).sort((left, right) => (right._depth ?? 0) - (left._depth ?? 0));
    for (const node of nodes) {
      if (node.id === currentRoot()?.id) continue;
      if (containsTreemapRectangleNode(
        node,
        point,
        visualization.config,
        (candidate) => visualization.leaf(candidate),
        visualization.clickedNode
      )) return node;
    }
    return null;
  }
  function showTooltip(event, node) {
    const data = node.data;
    if (!data.ticker) {
      tooltip.innerHTML = `<strong>${node.name}</strong><span>\u0628\u0631\u0627\u06CC \u0648\u0631\u0648\u062F \u0628\u0647 \u0627\u06CC\u0646 \u0628\u062E\u0634 \u06A9\u0644\u06CC\u06A9 \u06A9\u0646\u06CC\u062F</span>`;
    } else {
      tooltip.innerHTML = `
      <div class="tooltip-head"><strong dir="ltr">${data.ticker}</strong><b data-direction="${data.change >= 0 ? "up" : "down"}">${formatChange(data.change)}</b></div>
      <span>${data.company}</span>
      <dl><dt>\u0642\u06CC\u0645\u062A</dt><dd dir="ltr">$${data.price.toFixed(2)}</dd><dt>\u0627\u0631\u0632\u0634 \u0628\u0627\u0632\u0627\u0631</dt><dd dir="ltr">${formatMarketCap(data.marketCap)}</dd><dt>\u062D\u062C\u0645</dt><dd dir="ltr">${new Intl.NumberFormat("en-US", { notation: "compact" }).format(data.volume)}</dd></dl>`;
    }
    tooltip.hidden = false;
    const margin = 16;
    const left = Math.min(event.clientX + 18, window.innerWidth - tooltip.offsetWidth - margin);
    const top = Math.min(event.clientY + 18, window.innerHeight - tooltip.offsetHeight - margin);
    tooltip.style.transform = `translate(${Math.max(margin, left)}px, ${Math.max(margin, top)}px)`;
  }
  function hideTooltip() {
    tooltip.hidden = true;
  }
  function setHovered(node) {
    if (hoveredNode === node) return;
    hoveredNode?.removeData("border");
    hoveredNode = node;
    hoveredNode?.setData("border", "#f8fafc");
    visualization.plot();
  }
  function showStock(node) {
    const data = node.data;
    detail.innerHTML = `
    <span class="detail-symbol" dir="ltr">${data.ticker}</span>
    <span>${data.company}</span>
    <strong data-direction="${data.change >= 0 ? "up" : "down"}">${formatChange(data.change)}</strong>
    <span dir="ltr">$${data.price.toFixed(2)} \xB7 ${formatMarketCap(data.marketCap)}</span>`;
  }
  function afterIdle(callback) {
    const timer = window.setInterval(() => {
      if (!visualization.busy) {
        window.clearInterval(timer);
        callback();
      }
    }, 40);
  }
  canvas.canvases[0].canvas.addEventListener("pointermove", (event) => {
    if (visualization.busy || updating) return;
    const node = nodeAt(canvasPoint(event));
    setHovered(node);
    if (node) showTooltip(event, node);
    else hideTooltip();
  });
  canvas.canvases[0].canvas.addEventListener("pointerleave", () => {
    setHovered(null);
    hideTooltip();
  });
  canvas.canvases[0].canvas.addEventListener("click", (event) => {
    if (visualization.busy || updating) return;
    const node = nodeAt(canvasPoint(event));
    if (!node) return;
    if (visualization.leaf(node)) {
      showStock(node);
      return;
    }
    hideTooltip();
    setHovered(null);
    if (visualization.enter(node)) {
      updateBreadcrumb(node.name);
      afterIdle(updateBreadcrumb);
    }
  });
  canvas.canvases[0].canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    parentButton.click();
  });
  parentButton.addEventListener("click", () => {
    if (visualization.busy || updating || !visualization.clickedNode) return;
    setHovered(null);
    hideTooltip();
    if (visualization.out()) {
      updateBreadcrumb("\u062F\u0631 \u062D\u0627\u0644 \u0628\u0627\u0632\u06AF\u0634\u062A\u2026");
      afterIdle(updateBreadcrumb);
    }
  });
  function marketIndex(market) {
    const index = /* @__PURE__ */ new Map();
    for (const sector of market) {
      index.set(`sector-${sector.id}`, {
        area: sector.stocks.reduce((sum, stock) => sum + stock[2], 0),
        color: sector.color
      });
      for (const stock of sector.stocks) {
        index.set(`stock-${stock[0].replace(".", "-").toLowerCase()}`, {
          area: stock[2],
          color: buildMarketTree([{ ...sector, stocks: [stock] }]).children[0].children[0].data.$color,
          stock
        });
      }
    }
    return index;
  }
  function animateMarket(nextMarket, duration = 720) {
    if (updating || visualization.busy) return;
    updating = true;
    updateButton.disabled = true;
    resetButton.disabled = true;
    const targets = marketIndex(nextMarket);
    let rootArea = 0;
    for (const [id, target] of targets) {
      const node = visualization.graph.getNode(id);
      if (!node) continue;
      node.setData("area", target.area, "end");
      node.setData("color", target.color, "end");
      if (target.stock) {
        node.name = `${target.stock[0]}  ${formatChange(target.stock[4])}`;
        Object.assign(node.data, {
          marketCap: target.stock[2],
          price: target.stock[3],
          change: target.stock[4],
          volume: target.stock[5]
        });
      } else {
        rootArea += target.area;
      }
    }
    const root = visualization.graph.getNode("market");
    root?.setData("area", rootArea, "end");
    visualization.compute("end");
    visualization.animate({
      duration,
      modes: ["linear", "node-property:width:height:color"],
      onComplete: () => {
        currentMarket = nextMarket;
        for (const [id, target] of targets) {
          const node = visualization.graph.getNode(id);
          node?.setData("area", target.area);
          node?.setData("color", target.color);
        }
        root?.setData("area", rootArea);
        updating = false;
        updateButton.disabled = false;
        resetButton.disabled = false;
        updateSummary();
      }
    });
  }
  updateButton.addEventListener("click", () => {
    const volatility = { day: 1.8, week: 3.2, month: 5.4 }[timeframeSelect.value] ?? 1.8;
    animateMarket(simulateMarket(currentMarket, volatility));
  });
  resetButton.addEventListener("click", () => animateMarket(structuredClone(BASE_MARKET)));
  layoutSelect.addEventListener("change", () => {
    if (visualization.busy || updating) return;
    createVisualization(layoutSelect.value);
  });
  var observer = new ResizeObserver((entries) => {
    const rect = entries[0]?.contentRect;
    if (!rect) return;
    const width = Math.max(320, Math.floor(rect.width));
    const height = Math.max(420, Math.floor(rect.height));
    const current = canvas.getSize();
    if (width !== current.width || height !== current.height) canvas.resize(width, height);
  });
  observer.observe(host);
  createVisualization();
  window.setInterval(() => {
    if (document.hidden || updating || visualization.busy) return;
    const volatility = { day: 1.8, week: 3.2, month: 5.4 }[timeframeSelect.value] ?? 1.8;
    const tickVolatility = volatility * 0.18;
    animateMarket(
      simulateMarket(currentMarket, tickVolatility),
      MARKET_TICK_ANIMATION_MS
    );
  }, MARKET_TICK_MS);
})();
