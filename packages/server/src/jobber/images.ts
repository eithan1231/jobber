import assert from "assert";
import { readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import * as semver from "semver";
import { z } from "zod";
import { getConfigOption } from "~/config.js";
import { ActionsDockerArgumentsSchema } from "~/db/schema/actions.js";
import { createToken, fileExists, unzip } from "~/util.js";

export type ImagesEntry = {
  name: string;
  status: "active" | "deprecated" | "disabled";
  version: string;
  imageUrl: string;
} & ({ runtime: "node" } | { runtime: "python" });

const images: Array<ImagesEntry> = [
  {
    name: "node22",
    status: "active",
    runtime: "node",
    version: "v22",
    imageUrl: getConfigOption("RUNNER_IMAGE_NODE22_URL"),
  },
  {
    name: "node20",
    status: "active",
    runtime: "node",
    version: "v20",
    imageUrl: getConfigOption("RUNNER_IMAGE_NODE20_URL"),
  },
  {
    name: "python3",
    status: "disabled",
    runtime: "python",
    version: "v3",
    imageUrl: "",
  },
  {
    name: "python2",
    status: "disabled",
    runtime: "python",
    version: "v2",
    imageUrl: "",
  },
];

const defaultRuntimeImages = {
  node: "node22",
  python: "python3",
} as const;

export const getDefaultRuntimeImages = () => defaultRuntimeImages;

export const getImage = async (name: string): Promise<ImagesEntry | null> => {
  return images.find((image) => image.name === name) ?? null;
};

const getImageFromArchivePackageJson = (
  packageJson: ArchivePackageJsonSchemaType
): string => {
  if (!packageJson.engines?.node) {
    return getDefaultRuntimeImages().node;
  }

  for (const image of images) {
    if (image.runtime !== "node") {
      continue;
    }

    if (!semver.satisfies(image.version, packageJson.engines.node)) {
      continue;
    }

    return image.name;
  }

  return defaultRuntimeImages.node;
};

const archivePackageJsonSchema = z.object({
  name: z.string(),
  main: z
    .string()
    .refine((input) => input.startsWith("./"), "Must start with ./"),
  description: z.string(),
  version: z.string(),
  engines: z
    .object({
      node: z.string().optional(),
    })
    .optional(),
  action: z.object({
    runnerAsynchronous: z.boolean().optional(),
    runnerMinCount: z.number().optional(),
    runnerMaxCount: z.number().optional(),
    runnerTimeout: z.number().optional(),
    runnerMaxAge: z.number().optional(),
    runnerMaxAgeHard: z.number().optional(),
    runnerDockerArguments: z
      .lazy(() => ActionsDockerArgumentsSchema)
      .optional(),
    runnerMode: z.enum(["standard", "run-once"]).optional(),
  }),
  triggers: z.array(
    z.union([
      z.object({
        type: z.literal("schedule"),
        cron: z.string(),
        timezone: z.string().optional(),
      }),
      z.object({
        type: z.literal("http"),
        hostname: z.string().nullable().default(null),
        method: z.string().nullable().default(null),
        path: z.string().nullable().default(null),
      }),
      z.object({
        type: z.literal("mqtt"),
        topics: z.array(z.string()),
        connection: z.object({
          protocol: z.string().optional(),
          protocolVariable: z.string().optional(),

          port: z.string().optional(),
          portVariable: z.string().optional(),

          host: z.string().optional(),
          hostVariable: z.string().optional(),

          username: z.string().optional(),
          usernameVariable: z.string().optional(),

          password: z.string().optional(),
          passwordVariable: z.string().optional(),

          clientId: z.string().optional(),
          clientIdVariable: z.string().optional(),
        }),
      }),
    ])
  ),
  links: z
    .array(
      z.object({
        name: z.string(),
        url: z.string().url(),
      })
    )
    .default([]),
});

export type ArchivePackageJsonSchemaType = z.infer<
  typeof archivePackageJsonSchema
>;

export const classifyArchiveFile = async (
  filename: string
): Promise<
  | null
  | {
      type: "node";
      image: Extract<ImagesEntry, { runtime: "node" }>;
      package: ArchivePackageJsonSchemaType;
    }
  | {
      type: "python";
      image: Extract<ImagesEntry, { runtime: "python" }>;
    }
> => {
  const cleanupFiles: string[] = [];

  try {
    const directory = path.join(
      tmpdir(),
      createToken({ length: 12, prefix: "ArchiveValidation" })
    );

    cleanupFiles.push(directory);

    await unzip(filename, directory);

    const jobberFile = path.join(directory, "jobber.yaml");

    const packageFile = path.join(directory, "package.json");

    const jasJobberFile = await fileExists(jobberFile);

    const hasPackageJson = await fileExists(packageFile);

    // TODO: Refactor this function and support jobberFile

    if (hasPackageJson) {
      const packageJson = await archivePackageJsonSchema.parseAsync(
        JSON.parse(await readFile(packageFile, "utf8"))
      );

      const imageName = getImageFromArchivePackageJson(packageJson);

      if (!imageName) {
        console.log(`[classifyArchiveFile] Image name not found!`);

        return null;
      }

      const image = images.find((index) => index.name === imageName);

      assert(image);
      assert(image.runtime === "node");

      return {
        type: "node",
        package: packageJson,
        image,
      };
    }

    return null;
  } finally {
    for (const file of cleanupFiles) {
      await rm(file, { recursive: true });
    }
  }
};
