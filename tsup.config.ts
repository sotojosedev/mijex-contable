import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "persistence/pg/index": "src/persistence/pg/index.ts",
    "testing/index": "src/testing/index.ts",
  },
  format: ["esm"],
  target: "node22",
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: true,
  treeshake: true,
});
