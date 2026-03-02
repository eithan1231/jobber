import { z } from "zod";

export const ConfigurationOptionsSchema = z.object({
  // The port the gateway will listen to traffic on
  PORT: z.coerce.number().default(3000),

  // Upstream gRPC service (for gateway -> backend)
  GRPC_ENDPOINT: z.string().url(),

  // OIDC Issuer URL
  OIDC_ISSUER_URL: z.string().url(),

  // OIDC Discovery URL (if not provided, will be derived from issuer url)
  OIDC_DISCOVERY_URL: z.string().url().optional(),

  OAUTH_CLIENT_ID: z.string().min(1),
  OAUTH_CLIENT_SECRET: z.string().min(1),
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
