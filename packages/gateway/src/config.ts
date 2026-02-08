import { z } from "zod";

export const ConfigurationOptionsSchema = z.object({
  // The port the gateway will listen to traffic on
  GATEWAY_PORT: z.coerce.number().default(3001),

  // API Key for the gateway to authenticate with the central server
  GRPC_MANAGEMENT_TOKEN: z.string(),
  GRPC_MANAGEMENT_URL: z.string(),
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
