import { JobberPermissions } from "@jobber/common/permissions.js";
import assert from "node:assert";
import { z } from "zod";
import { userModel } from "~/db/user.js";
import { defineSeed } from "./types.js";
import {
  extractPermissionFromSeedPermissionSchema,
  SeedPermissionSchema,
} from "./utils.js";

export const seedUsers = defineSeed({
  name: "users",
  payload: z
    .object({
      userPermissions: z.record(z.string(), SeedPermissionSchema),
    })
    .optional(),
  handler: async (payload) => {
    assert(payload);

    for (const [username, seedPermission] of Object.entries(
      payload.userPermissions,
    )) {
      const user = await userModel.byUsername(username);

      if (!user) {
        console.log(
          `User with username ${username} not found, skipping seeding for this user.`,
        );

        continue;
      }

      const permissions: JobberPermissions =
        extractPermissionFromSeedPermissionSchema(seedPermission);

      await userModel.update(user.id, {
        permissions,
      });
    }
  },
});
