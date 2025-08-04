import { JobberGenericResponse, JobberPermissions } from "./common";

export type JobberUser = {
  id: string;
  username: string;
  permissions: JobberPermissions;
  created: string;
};

export const getUsers = async (): Promise<
  JobberGenericResponse<JobberUser[]>
> => {
  const result = await fetch(`/api/users/`);

  return result.json();
};

export const getUser = async (
  userId: string
): Promise<JobberGenericResponse<JobberUser>> => {
  const result = await fetch(`/api/users/${userId}`);

  return result.json();
};

export const createUser = async (
  username: string,
  password: string,
  permissions: JobberPermissions
): Promise<JobberGenericResponse<JobberUser>> => {
  const result = await fetch(`/api/users/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password, permissions }),
  });

  return result.json();
};

export const updateUser = async (
  userId: string,
  payload: {
    username?: string;
    password?: string;
    permissions?: JobberPermissions;
  }
): Promise<JobberGenericResponse<JobberUser>> => {
  const result = await fetch(`/api/users/${userId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return result.json();
};
