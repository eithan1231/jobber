import { z } from "zod";

export const ConfigurationOptionsSchema = z.object({
  /**
   * Is authentication required? If this is false, user will bypass `api_auth_bearer_token` header validation
   */
  API_AUTH_REQUIRE_BEARER: z
    .string()
    .transform((val) => val.toLowerCase() === "true")
    .pipe(z.boolean())
    .default("true"),
  API_AUTH_BEARER_TOKEN: z.string().optional(),

  /**
   * Debug the console output for runner processes.
   */
  DEBUG_RUNNER_STD: z
    .string()
    .transform((val) => val.toLowerCase() === "true")
    .pipe(z.boolean())
    .default("false"),
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
