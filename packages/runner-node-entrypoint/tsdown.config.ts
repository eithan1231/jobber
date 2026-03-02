import { defineConfig } from "tsdown";

const parseName = (path: string) => {
  const parts = path.split("/");

  const lastNodeModule = parts.lastIndexOf("node_modules");

  parts.splice(0, lastNodeModule + 1);

  return parts;
};

export default defineConfig({
  entry: "src/index.ts",
  tsconfig: "tsconfig.json",
  noExternal: /.*/,
  treeshake: true,
  format: {
    cjs: {
      target: ["node16"],
      dts: false,
      outDir: "dist/cjs",
    },
    esm: {
      target: ["node16"],
      dts: false,
      outDir: "dist/esm",
    },
  },
  outputOptions: {
    legalComments: "none",
    sourcemap: "hidden",
    entryFileNames: "jobber-start.js",

    chunkFileNames: (chunk) => {
      return "jobber-modules/[name].js";
    },

    codeSplitting: {
      includeDependenciesRecursively: true,
      groups: [
        {
          name: (item) => {
            const parts = parseName(item);
            const firstPart = parts.at(0);

            if (firstPart?.startsWith("@jobber")) {
              return `${firstPart}-${parts.at(1)}`;
            }

            return `${firstPart}`;
          },
          test: /node_modules/,
          priority: 100,
        },
      ],
    },
    exports: "named",
  },
});
