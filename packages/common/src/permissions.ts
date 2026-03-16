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

export const PERMISSION_SUPER: JobberPermissions = [
  {
    effect: "allow",
    resource: "*",
    actions: ["read", "write", "delete"],
  },
] as const;

export const PERMISSION_NONE: JobberPermissions = [
  {
    effect: "deny",
    resource: "*",
    actions: ["read", "write", "delete"],
  },
] as const;

export const PERMISSION_READ_ONLY: JobberPermissions = [
  {
    effect: "allow",
    resource: "*",
    actions: ["read"],
  },
] as const;

export const PERMISSION_GATEWAY: JobberPermissions = [
  {
    effect: "allow",
    resource: "job/*",
    actions: ["read"],
  },
  {
    effect: "allow",
    resource: "special/job/*/runner-status",
    actions: ["read"],
  },
  {
    effect: "allow",
    resource: "templates",
    actions: ["read"],
  },
  {
    effect: "allow",
    resource: "special/job/*/invoke-http-event",
    actions: ["write"],
  },
  {
    effect: "allow",
    resource: "special/job/*/create-soft-runner",
    actions: ["write"],
  },
  {
    effect: "allow",
    resource: "job/*/runners",
    actions: ["read", "delete"],
  },
  {
    effect: "deny",
    resource: "job/*/environment/*",
    actions: ["read", "write", "delete"],
  },
  {
    effect: "deny",
    resource: "job/*/runners",
    actions: ["write", "delete"],
  },
  {
    effect: "deny",
    resource: "job/*/store",
    actions: ["read", "write", "delete"],
  },
  {
    effect: "deny",
    resource: "job/*/versions/*/archive",
    actions: ["read", "write", "delete"],
  },
  {
    effect: "deny",
    resource: "job/*/publish",
    actions: ["read", "write", "delete"],
  },
  {
    effect: "deny",
    resource: "api-tokens",
    actions: ["read", "write", "delete"],
  },
  {
    effect: "deny",
    resource: "system",
    actions: ["read", "write", "delete"],
  },
  {
    effect: "deny",
    resource: "users",
    actions: ["read", "write", "delete"],
  },
] as const;

export const canPerformAction = (
  permissions: JobberPermissions,
  resource: string,
  action: JobberPermissionAction,
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
