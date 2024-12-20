import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  splitting: false,
  sourcemap: false,
  clean: true,
  noExternal: ["@jobber/tcp-frame-socket"],
  target: "es2020",
  platform: "node",
  format: "esm",
});
