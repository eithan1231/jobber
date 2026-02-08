import { JobberPermissions } from "@jobber/common/permissions.js";
import { JobberGenericResponse } from "./common";

export type JobberOAuthSigningKey = {
  id: string;
  parentId: string | null;
  childId: string | null;

  createdByUserId: string;

  status: "active" | "inactive" | "revoked";

  alg: string;
  use: string;

  publicKey: string;

  expiresAt: string | null;
  renewsAt: string | null;
  createdAt: string;
};

export type JobberOAuthServiceClient = {
  id: string;
  clientId: string;

  name: string;
  description: string;

  isSystemManaged: boolean;

  allowedAudiences: string[];
  allowedScopes: string[];

  permissions: JobberPermissions;

  enabled: boolean;

  expiresAt: string | null;
  createdAt: string;
};

export const getOAuthSigningKeys = async (): Promise<
  JobberGenericResponse<JobberOAuthSigningKey[]>
> => {
  const result = await fetch(`/api/oauth/signing-keys/`);

  return result.json();
};

export const getOAuthSigningKey = async (
  keyId: string,
): Promise<JobberGenericResponse<JobberOAuthSigningKey>> => {
  const result = await fetch(`/api/oauth/signing-keys/${keyId}`);

  return result.json();
};

export const updateOAuthSigningKey = async (
  keyId: string,
  payload: {
    status?: "active" | "inactive" | "revoked";
    expiresAt?: string | null;
  },
): Promise<JobberGenericResponse<JobberOAuthSigningKey>> => {
  const result = await fetch(`/api/oauth/signing-keys/${keyId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return result.json();
};

export const createOAuthSigningKey = async (payload: {
  alg: "RS256";
  use: "sig" | "enc";

  expiresAt?: string | null;
  renewsAt?: string | null;

  parentId?: string | null;
}): Promise<JobberGenericResponse<JobberOAuthSigningKey>> => {
  const result = await fetch(`/api/oauth/signing-keys/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return result.json();
};

export const getOAuthServiceClients = async (): Promise<
  JobberGenericResponse<JobberOAuthServiceClient[]>
> => {
  const result = await fetch(`/api/oauth/service-client/`);

  return result.json();
};

export const getOAuthServiceClient = async (
  clientId: string,
): Promise<JobberGenericResponse<JobberOAuthServiceClient>> => {
  const result = await fetch(`/api/oauth/service-client/${clientId}`);

  return result.json();
};

export const createOAuthServiceClient = async (payload: {
  name: string;
  description?: string;

  allowedAudiences: string[];
  allowedScopes: string[];

  permissions: JobberPermissions;

  expiresAt?: string | null;
}): Promise<
  JobberGenericResponse<{ client: JobberOAuthServiceClient; secret: string }>
> => {
  const result = await fetch(`/api/oauth/service-client/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return result.json();
};
