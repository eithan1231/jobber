import { hostname } from "os";
import { z } from "zod";

export const ConfigurationOptionsSchema = z.object({
  DATABASE_URL: z.string(),

  JOBBER_NAME: z.string().default("Jobber"),

  STARTUP_USERNAME: z.string().default("admin"),
  STARTUP_PASSWORD: z.string().default("Password1!"),

  AUTH_PUBLIC_REGISTRATION_ENABLED: z
    .string()
    .transform((val) => val.toLowerCase() === "true")
    .pipe(z.boolean())
    .default("false"),
  AUTH_PUBLIC_LOGIN_ENABLED: z
    .string()
    .transform((val) => val.toLowerCase() === "true")
    .pipe(z.boolean())
    .default("true"),

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
    .default("eithan1231/runner-node-22:latest"),

  RUNNER_IMAGE_NODE20_URL: z
    .string()
    .default("eithan1231/runner-node-20:latest"),

  RUNNER_CONTAINER_DOCKER_NETWORK: z.string().optional(),

  RUNNER_ALLOW_DOCKER_ARGUMENT_TYPES: z
    .string()
    .transform((val) => val.split(",").map((type) => type.trim().toLowerCase()))
    .pipe(
      z.array(
        z.enum([
          "",
          "volumes",
          "networks",
          "labels",
          "memoryLimit",
          "directPassthroughArguments",
        ])
      )
    )
    .default(""),

  RUNNER_ALLOW_ARGUMENT_DIRECT_PASSTHROUGH: z
    .string()
    .transform((val) => val.toLowerCase() === "true")
    .pipe(z.boolean())
    .default("false"),

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
    .describe("Example: http://localhost/loki/api/v1/query_range"),
  LOG_DRIVER_LOKI_QUERY_RANGE: z.coerce
    .number()
    .default(60 * 60 * 24)
    .describe("The maximum duration we can fetch logs from the past."),

  METRICS_PROMETHEUS_QUERY: z
    .string()
    .nullable()
    .default(null)
    .describe("Example: http://localhost/api/v1/query_range"),

  METRICS_PROMETHEUS_JOB_NAME: z
    .string()
    .nullable()
    .default(null)
    .describe("the job_name in your prometheus scrape config"),

  METRICS_PROMETHEUS_QUERY_STEP: z.coerce
    .number()
    .min(1)
    .default(15)
    .describe(
      "The step in seconds for the Prometheus query. Default is 15 seconds."
    ),
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
