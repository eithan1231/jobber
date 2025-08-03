import { JobberGenericResponse } from "./common";

export type JobberAuth = {
  permissions: Array<{
    effect: "allow" | "deny";
    resource: string;
    actions: Array<"read" | "write" | "delete" | "execute">;
  }>;
  user?: {
    id: string;
    username: string;
  };
  token?: {
    expires: string;
  };
};

export const createAuthLogin = async (
  username: string,
  password: string
): Promise<JobberGenericResponse> => {
  const result = await fetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      username,
      password,
    }),
    headers: {
      "Content-Type": "application/json",
    },
  });

  return await result.json();
};

export const createAuthRegister = async (
  username: string,
  password: string
): Promise<JobberGenericResponse> => {
  const result = await fetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      username,
      password,
    }),
    headers: {
      "Content-Type": "application/json",
    },
  });

  return await result.json();
};

export const getAuth = async (): Promise<JobberGenericResponse<JobberAuth>> => {
  const result = await fetch("/api/auth");

  return await result.json();
};
