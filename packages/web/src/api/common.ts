export type JobberGenericResponse<T = undefined> =
  | {
      success: true;
      message: string;
      data: T;
    }
  | {
      success: false;
      message: string;
    };

export type JobberPermissions = Array<{
  effect: "allow" | "deny";
  resource: string;
  actions: Array<"read" | "write" | "delete">;
}>;
