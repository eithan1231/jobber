// Would be great to use zod, but its another dependency that should be avoided.

type PackageJson = {
  name: string;
  version: string;
  main: string;
};

type ValidationResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      errors: string[];
    };

export function validatePackageJson(
  data: unknown,
): ValidationResult<PackageJson> {
  const errors: string[] = [];
  const partial = {} as Partial<PackageJson>;

  if (typeof data !== "object" || data === null) {
    return {
      success: false,
      errors: ["package.json must be an object"],
    };
  }

  if (!("name" in data) || typeof data.name !== "string") {
    errors.push('property "name" must be a string');
  } else {
    partial.name = data.name;
  }

  if (!("version" in data) || typeof data.version !== "string") {
    errors.push('property "version" must be a string');
  } else {
    partial.version = data.version;
  }

  if (!("main" in data) || typeof data.main !== "string") {
    errors.push('property "main" must be a string if it exists');
  } else {
    partial.main = data.main;
  }

  if (errors.length > 0) {
    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    data: partial as PackageJson,
  };
}
