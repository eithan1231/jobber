import { JobberGenericResponse, JobberPermissions } from "./common";

export type JobberApiToken = {
  id: string;
  userId: string;
  permissions: JobberPermissions;
  description: string | null;
  status: "enabled" | "disabled";
  created: string;
  expires: string;
};

export type JobberApiTokenFull = JobberApiToken & {
  token: string;
};

export const getApiTokens = async (): Promise<
  JobberGenericResponse<JobberApiToken[]>
> => {
  const result = await fetch(`/api/api-tokens/`);

  return result.json();
};

export const getApiToken = async (
  tokenId: string
): Promise<JobberGenericResponse<JobberApiToken>> => {
  const result = await fetch(`/api/api-tokens/${tokenId}`);

  return result.json();
};

export const createApiToken = async (
  permissions: JobberPermissions,
  description: string,
  ttl: number
): Promise<JobberGenericResponse<JobberApiTokenFull>> => {
  const result = await fetch(`/api/api-tokens/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ permissions, ttl, description }),
  });

  return result.json();
};

export const updateApiToken = async (
  tokenId: string,
  payload: {
    permissions?: JobberPermissions;
    status?: "enabled" | "disabled";
    description?: string;
  }
): Promise<JobberGenericResponse<JobberApiToken>> => {
  const result = await fetch(`/api/api-tokens/${tokenId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return result.json();
};

export const deleteApiToken = async (
  tokenId: string
): Promise<JobberGenericResponse<{}>> => {
  const result = await fetch(`/api/api-tokens/${tokenId}`, {
    method: "DELETE",
  });

  return result.json();
};
