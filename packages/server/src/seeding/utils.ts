import {
  JobberPermissions,
  JobberPermissionsSchema,
  PERMISSION_SUPER,
} from "@jobber/common/permissions.js";
import { z } from "zod";

export const SeedPermissionSchema = z.union([
  z.object({
    type: z.literal("custom"),
    permissions: JobberPermissionsSchema,
  }),
  z.object({
    type: z.literal("all"),
  }),
]);

export const extractPermissionFromSeedPermissionSchema = (
  input: z.infer<typeof SeedPermissionSchema>,
): JobberPermissions => {
  const permissions: JobberPermissions = [];

  if (input.type === "all") {
    permissions.push(...PERMISSION_SUPER);
  } else if (input.type === "custom") {
    permissions.push(...input.permissions);
  }

  return permissions;
};
