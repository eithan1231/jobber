import { JobberPermissions } from "@jobber/common/permissions.js";
import assert from "node:assert";
import { z } from "zod";
import { userModel } from "~/db/user.js";
import { defineSeed } from "./types.js";
import {
  extractPermissionFromSeedPermissionSchema,
  SeedPermissionSchema,
} from "./utils.js";
import { apiTokensModel } from "~/db/api-tokens.js";

export const seedApiTokens = defineSeed({
  name: "api-tokens",
  payload: z
    .array(
      z.object({
        token: z.string().min(8),
        permissions: SeedPermissionSchema,
        ttl: z.number().optional(),
      }),
    )
    .optional(),
  handler: async (payload) => {
    assert(payload);

    for (const item of Object.values(payload)) {
      const existing = await apiTokensModel.byToken(item.token);

      let expires: Date;
      if (item.ttl) {
        expires = new Date(Date.now() + item.ttl * 1000);
      } else {
        // Set expiration to 100 years in the future if ttl is not provided
        expires = new Date();
        expires.setFullYear(expires.getFullYear() + 100);
      }

      if (existing) {
        apiTokensModel.update(existing.id, {
          permissions: extractPermissionFromSeedPermissionSchema(
            item.permissions,
          ),
          expires,
        });

        continue;
      } else {
        const anonymousUser = await userModel.byUsername("anonymous");

        if (!anonymousUser) {
          console.log(
            // This should never happen, as the anonymous user is seeded by default
            `Anonymous user not found, skipping seeding for API token with token ${item.token}.`,
          );

          continue;
        }

        apiTokensModel.create({
          token: item.token,
          permissions: extractPermissionFromSeedPermissionSchema(
            item.permissions,
          ),
          expires,
          userId: anonymousUser.id,
          description: "Seeded API token",
          status: "enabled",
        });
      }
    }
  },
});
