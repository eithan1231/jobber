import { z } from "zod";

export const ConfigurationOptionsSchema = z.object({
  API_AUTH_BEARER_TOKEN: z.string().optional(),

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
