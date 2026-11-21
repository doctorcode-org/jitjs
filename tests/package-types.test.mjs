import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const rootPath = fileURLToPath(new URL("../", import.meta.url));
const importer = path.join(rootPath, "tests", "package-consumer.ts");
const optionModules = [
  "area-chart",
  "bar-chart",
  "canvas",
  "controller",
  "edge",
  "events",
  "fx",
  "label",
  "margin",
  "navigation",
  "node-styles",
  "node",
  "pie-chart",
  "tips",
  "tree",
];

function publicSpecifiers(packageJson) {
  const result = [];
  for (const subpath of Object.keys(packageJson.exports)) {
    if (subpath === ".") {
      result.push(packageJson.name);
    } else if (subpath.includes("*")) {
      for (const option of optionModules) {
        result.push(`${packageJson.name}/${subpath.slice(2).replace("*", option)}`);
      }
    } else {
      result.push(`${packageJson.name}/${subpath.slice(2)}`);
    }
  }
  return result;
}

test("TypeScript consumers resolve every subpath through package exports", async () => {
  const packageJson = JSON.parse(
    await readFile(path.join(rootPath, "package.json"), "utf8"),
  );
  const modes = [
    ["NodeNext", ts.ModuleKind.NodeNext, ts.ModuleResolutionKind.NodeNext],
    ["Bundler", ts.ModuleKind.ESNext, ts.ModuleResolutionKind.Bundler],
  ];

  for (const specifier of publicSpecifiers(packageJson)) {
    for (const [name, module, moduleResolution] of modes) {
      const resolution = ts.resolveModuleName(
        specifier,
        importer,
        {
          module,
          moduleResolution,
          target: ts.ScriptTarget.ES2022,
        },
        ts.sys,
      ).resolvedModule;

      assert.ok(resolution, `${name}: ${specifier}`);
      assert.match(
        resolution.resolvedFileName.replaceAll("\\", "/"),
        /\/dist\/.*\.d\.ts$/,
        `${name}: ${specifier}`,
      );
    }
  }
});
