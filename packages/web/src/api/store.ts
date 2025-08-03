import { JobberGenericResponse } from "./common";

export type JobberStoreItem = {
  id: string;
  jobId: string;
  key: string;
  value: string;
  expiry?: number;
  modified: number;
  created: number;
};

export type JobberStoreItemPartial = Omit<JobberStoreItem, "value">;

export const getJobStore = async (
  jobId: string
): Promise<JobberGenericResponse<JobberStoreItemPartial[]>> => {
  const result = await fetch(`/api/job/${jobId}/store/`);
  return await result.json();
};

export const getJobStoreItem = async (
  jobId: string,
  storeId: string
): Promise<JobberGenericResponse<JobberStoreItem>> => {
  const result = await fetch(`/api/job/${jobId}/store/${storeId}`);

  return await result.json();
};

export const deleteJobStoreItem = async (
  jobId: string,
  storeId: string
): Promise<JobberGenericResponse<JobberStoreItem>> => {
  const result = await fetch(`/api/job/${jobId}/store/${storeId}`, {
    method: "DELETE",
  });

  return await result.json();
};
