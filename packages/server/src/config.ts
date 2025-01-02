import { hostname } from "os";
import { z } from "zod";

export const ConfigurationOptionsSchema = z.object({
  DATABASE_URL: z.string(),

  DEBUG_HTTP: z
    .string()
    .transform((val) => val.toLowerCase() === "true")
    .pipe(z.boolean())
    .default("true"),

  DEBUG_RUNNER: z
    .string()
    .transform((val) => val.toLowerCase() === "true")
    .pipe(z.boolean())
    .default("false"),

  MANAGER_PORT: z.coerce.number().default(5211),
  MANAGER_HOST: z.string().default(hostname()),

  RUNNER_IMAGE_NODE22_URL: z
    .string()
    .default("forgejo.eithan.me/eithan/runner-node-22:latest"),

  RUNNER_IMAGE_NODE20_URL: z
    .string()
    .default("forgejo.eithan.me/eithan/runner-node-20:latest"),

  RUNNER_CONTAINER_DOCKER_NETWORK: z.string().optional(),

  LOG_DRIVER: z.enum(["database", "loki"]).default("database"),
  LOG_DRIVER_LOKI_PUSH: z
    .string()
    .nullable()
    .default(null)
    .describe("Example: http://localhost/loki/api/v1/push"),
  LOG_DRIVER_LOKI_QUERY: z
    .string()
    .nullable()
    .default(null)
    .describe("Example: http://localhost/loki/api/v1/query"),
});

export type ConfigurationOptionsSchemaType = z.infer<
  typeof ConfigurationOptionsSchema
>;

export type ConfigurationOptions = keyof ConfigurationOptionsSchemaType;

export const getConfigOption = <T extends ConfigurationOptions>(
  option: T
): ConfigurationOptionsSchemaType[T] => {
  const schema = ConfigurationOptionsSchema.shape[option];

  return schema.parse(process.env[option], {
    path: ["config", option],
  }) as ConfigurationOptionsSchemaType[T];
};
