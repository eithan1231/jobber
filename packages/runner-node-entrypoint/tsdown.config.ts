import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  sourcemap: false,
  clean: true,
  deps: {
    alwaysBundle: ["@jobber/tcp-frame-socket"],
  },
  target: "es2020",
  platform: "node",
  format: "esm",

  // The Docker images copy dist/index.js as-is, and nothing consumes type declarations.
  fixedExtension: false,
  dts: false,
});
