import { JobberGenericResponse } from "./common";

export type JobberEnvironment = {
  [name: string]:
    | {
        type: "text";
        value: string;
      }
    | {
        type: "secret";
      };
};

export const getJobEnvironment = async (
  jobId: string
): Promise<JobberGenericResponse<JobberEnvironment>> => {
  const result = await fetch(`/api/job/${jobId}/environment`);

  return result.json();
};

export const upsertJobEnvironmentVariable = async (
  jobId: string,
  name: string,
  value: string,
  type: "text" | "secret"
): Promise<JobberGenericResponse> => {
  const form = new FormData();

  form.set("type", type);
  form.set("value", value);

  const result = await fetch(`/api/job/${jobId}/environment/${name}`, {
    method: "POST",
    body: form,
  });

  return await result.json();
};

export const deleteJobEnvironmentVariable = async (
  jobId: string,
  name: string
): Promise<JobberGenericResponse> => {
  const result = await fetch(`/api/job/${jobId}/environment/${name}`, {
    method: "DELETE",
  });

  return await result.json();
};
