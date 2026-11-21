# Upstream source coverage

This rewrite covers every JavaScript source file currently present under the
upstream `philogb/jit/Source` tree. The executable inventory is maintained in
`tests/upstream-source-coverage.test.mjs`; it maps each upstream file to one or
more owning TypeScript modules and verifies that those modules exist.

The rewrite intentionally does not recreate the `$jit` global, mutable shape
and label registries, the legacy `Class` mixin factory, or monolithic namespace
aggregators. Those compatibility mechanisms are replaced by named ESM exports,
native TypeScript classes, narrow package subpaths, and dependency injection.
Reintroducing them would make otherwise independent features reachable from a
shared import graph and weaken tree-shaking.

Behavior is checked in three layers:

- differential tests against the frozen JIT 2.0.1 bundle for code included in
  that build;
- source-characterization and invariant tests for optional upstream modules
  such as computational geometry, WebGL, StreamChart, and Voronoi;
- package and static-closure tests that enforce ESM-only output, no global
  installation, and isolation of optional algorithms, renderers, labels, DOM,
  Canvas, and WebGL code.

Run `npm run check` to type-check, build, and execute the complete verification
suite.
