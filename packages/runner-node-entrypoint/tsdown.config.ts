import { defineConfig } from "tsdown";

export default defineConfig({
  entry: "src/index.ts",
  outDir: "dist",
  tsconfig: "tsconfig.json",
  noExternal: /.*/,
  treeshake: true,
  format: {
    cjs: {
      target: ["node16"],
      dts: false,
    },
    esm: {
      target: ["node16"],
      dts: false,
    },
  },
  outputOptions: {
    legalComments: "none",
    minify: true,
    sourcemap: "hidden",
    codeSplitting: {
      includeDependenciesRecursively: true,
      maxSize: 100 * 1024, // 100 KB
    },
    exports: "named",
  },
});
