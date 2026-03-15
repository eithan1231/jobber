import { hostname } from "os";
import { z } from "zod";
import { getSeedSchema } from "./seeding/index.js";

export const ConfigurationOptionsSchema = z.object({
  SECRET_PASSPHRASE: z.string().min(32).max(512),

  DATABASE_URL: z.string(),
  DATABASE_BACKUP_SCHEDULE: z.string().default("0 0 * * *"),
  DATABASE_BACKUP_SCHEDULE_TIMEZONE: z.string().default("UTC"),
  DATABASE_BACKUP_RETENTION_COUNT: z.coerce.number().default(32),

  JOBBER_NAME: z.string().default("Jobber"),

  STARTUP_USERNAME: z.string().optional().default("admin"),
  STARTUP_PASSWORD: z.string().optional().default("Password1!"),

  SEED: z
    .string()
    .default("{}")
    .transform((val) => {
      return JSON.parse(val);
    })
    .pipe(getSeedSchema()),

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

  ALLOWED_HOSTS: z
    .string()
    .default("")
    .transform((val) =>
      val.split(",").map((host) => host.trim().toLowerCase()),
    ),

  OAUTH_ISSUER: z.string().default("http://localhost:5211"),
  OAUTH_SIGNING_KEY_ROTATE_IN_DAYS: z.coerce.number().default(5), // Rotate X days after creation
  OAUTH_SIGNING_KEY_EXPIRE_IN_DAYS: z.coerce.number().default(30), // Expire X days after creation
  OAUTH_MANAGEMENT_ALLOW_MANUAL_UPLOAD: z
    .string()
    .transform((val) => val.toLowerCase() === "true")
    .pipe(z.boolean())
    .default("false")
    .describe(
      "Determines whether or not you can manually upload signing keys through the API. This includes frontend and backend.",
    ),

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

  API_PORT: z.coerce.number().default(3000),

  // GRPC specific config
  MANAGER_GRPC_PORT: z.coerce.number().default(5212),
  MANAGER_GRPC_HOST: z.string().default(hostname()), // For the runners
  MANAGER_GRPC_BIND_ADDRESS: z.string().default("0.0.0.0"),

  RUNNER_IMAGE_NODE24_URL: z
    .string()
    .default("eithan1231/runner-node-24:latest"),

  RUNNER_IMAGE_NODE22_URL: z
    .string()
    .default("eithan1231/runner-node-22:latest"),

  RUNNER_IMAGE_NODE20_URL: z
    .string()
    .default("eithan1231/runner-node-20:latest"),

  RUNNER_CONTAINER_DOCKER_NETWORK: z.string().optional(),

  RUNNER_ALLOW_DOCKER_ARGUMENT_TYPES: z
    .string()
    .transform((val) => val.split(",").map((type) => type.trim()))
    .pipe(
      z.array(
        z.enum([
          "",
          "volumes",
          "networks",
          "labels",
          "memoryLimit",
          "directPassthroughArguments",
        ]),
      ),
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
      "The step in seconds for the Prometheus query. Default is 15 seconds.",
    ),
});

export type ConfigurationOptionsSchemaType = z.infer<
  typeof ConfigurationOptionsSchema
>;

export type ConfigurationOptions = keyof ConfigurationOptionsSchemaType;

export const getConfigOption = <T extends ConfigurationOptions>(
  option: T,
): ConfigurationOptionsSchemaType[T] => {
  const schema = ConfigurationOptionsSchema.shape[option];

  return schema.parse(process.env[option], {
    path: ["config", option],
  }) as ConfigurationOptionsSchemaType[T];
};
