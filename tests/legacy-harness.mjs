import { readFileSync } from "node:fs";
import { Script, createContext } from "node:vm";

let cachedEnvironment;

function loadLegacyEnvironment() {
  if (cachedEnvironment) {
    return cachedEnvironment;
  }

  const source = readFileSync(new URL("../jit.js", import.meta.url), "utf8");
  const instrumentedSource = source.replace(
    /\s*\}\)\(\);\s*$/,
    "\nwindow.__legacyInternals = { Loader: Loader, NodeDim: NodeDim, Options: Options, Extras: Extras, MouseEventsManager: MouseEventsManager };\n})();",
  );
  const sandbox = {
    clearInterval,
    clearTimeout,
    console,
    document: {},
    setInterval,
    setTimeout,
  };
  sandbox.window = sandbox;

  const context = createContext(sandbox);
  new Script(instrumentedSource, { filename: "jit.js" }).runInContext(context);
  cachedEnvironment = { context, sandbox };
  return cachedEnvironment;
}

export function loadLegacyNamespace() {
  return loadLegacyEnvironment().sandbox.$jit;
}

export function loadLegacyBinding(bindingName) {
  if (!/^[A-Za-z_$][\w$]*$/.test(bindingName)) {
    throw new TypeError(`Invalid legacy binding name: ${bindingName}`);
  }
  const { sandbox } = loadLegacyEnvironment();
  const value = sandbox.__legacyInternals?.[bindingName];
  if (value === undefined) {
    throw new ReferenceError(`Legacy binding is not exposed: ${bindingName}`);
  }
  return value;
}

export function setLegacyDocument(ownerDocument) {
  loadLegacyEnvironment().sandbox.document = ownerDocument;
}

export function setLegacyGlobal(name, value) {
  if (!/^[A-Za-z_$][\w$]*$/.test(name)) {
    throw new TypeError(`Invalid legacy global name: ${name}`);
  }
  loadLegacyEnvironment().sandbox[name] = value;
}

export function normalizeRealm(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}
