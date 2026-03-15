import {
  getOAuthAudienceGatewayApi,
  getOAuthAudienceGeneralApi,
  getOAuthAudienceRunnerApi,
} from "@jobber/common/oauth.js";
import assert from "node:assert";
import { z } from "zod";
import { oauthServiceClientModel } from "~/db/oauth-service-client.js";
import { defineSeed } from "./types.js";
import {
  extractPermissionFromSeedPermissionSchema,
  SeedPermissionSchema,
} from "./utils.js";

export const seedOauthClients = defineSeed({
  name: "oauth-clients",
  payload: z
    .object({
      clientId: z.string().min(8),
      clientSecret: z.string().min(16),
      allowedAudiences: z
        .string()
        .array()
        .default([
          getOAuthAudienceGatewayApi(),
          getOAuthAudienceGeneralApi(),
          getOAuthAudienceRunnerApi("*"),
        ]),
      permissions: SeedPermissionSchema.default({ type: "all" }),
    })
    .optional(),
  handler: async (payload) => {
    assert(payload);

    await oauthServiceClientModel.upsert({
      clientId: payload.clientId,
      metadata: {
        type: "client_secret_basic_insecure",
        clientSecret: payload.clientSecret,
      },
      allowedAudiences: payload.allowedAudiences ?? [],
      allowedScopes: [],
      name: "Seeded Client",
      description: "A client created from the seed script.",
      enabled: true,
      isSystemManaged: false,
      permissions: extractPermissionFromSeedPermissionSchema(
        payload.permissions,
      ),
    });
  },
});
