export type JobberPermissionEffect = "allow" | "deny";
export type JobberPermissionAction = "read" | "write" | "delete" | "execute";

export type JobberPermissions = Array<{
  effect: JobberPermissionEffect;
  resource: string;
  actions: JobberPermissionAction[];
}>;

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
