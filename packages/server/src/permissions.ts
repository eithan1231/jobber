import { z } from "zod";
export const JobberPermissionEffectSchema = z.enum(["allow", "deny"]);
export const JobberPermissionActionSchema = z.enum(["read", "write", "delete"]);

export const JobberPermissionSchema = z.object({
  effect: JobberPermissionEffectSchema,
  resource: z.string(),
  actions: z.array(JobberPermissionActionSchema),
});

export const JobberPermissionsSchema = z.array(JobberPermissionSchema);

export type JobberPermissionEffect = z.infer<
  typeof JobberPermissionEffectSchema
>;
export type JobberPermissionAction = z.infer<
  typeof JobberPermissionActionSchema
>;

export type JobberPermission = z.infer<typeof JobberPermissionSchema>;
export type JobberPermissions = z.infer<typeof JobberPermissionsSchema>;

export const canPerformAction = (
  permissions: JobberPermissions,
  resource: string,
  action: JobberPermissionAction
): boolean => {
  // Check for deny permissions first
  for (const permission of permissions) {
    if (permission.effect !== "deny") {
      continue;
    }

    if (!permission.actions.includes(action)) {
      continue;
    }

    if (!resourceMatches(resource, permission.resource)) {
      continue;
    }

    return false;
  }

  // If no deny permissions matched, check for allow permissions
  for (const permission of permissions) {
    if (permission.effect !== "allow") {
      continue;
    }

    if (!permission.actions.includes(action)) {
      continue;
    }

    if (!resourceMatches(resource, permission.resource)) {
      continue;
    }

    return true;
  }

  return false;
};

export const resourceMatches = (resource: string, pattern: string) => {
  const resourceParts = resource.split("/");
  const patternParts = pattern.split("/");

  for (const [patternPartIndex, patternPart] of patternParts.entries()) {
    const resourcePart = resourceParts.at(patternPartIndex);

    if (patternPart === "*") {
      continue;
    }

    if (resourcePart === undefined) {
      return false;
    }

    if (resourcePart !== patternPart) {
      return false;
    }
  }

  return true;
};
