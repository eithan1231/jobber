import { JobberGenericResponse } from "./common";

export type JobberRunner = {
  id: string;
  status: "starting" | "ready" | "closing" | "closed";
  actionId: string;
  jobId: string;
  requestsProcessing: number;
  createdAt: number;
  readyAt?: number;
  closingAt?: number;
  closedAt?: number;
};

export const getJobRunners = async (
  jobId: string
): Promise<JobberGenericResponse<JobberRunner[]>> => {
  const result = await fetch(`/api/job/${jobId}/runners`);

  return await result.json();
};

export const getJobRunnersByActionId = async (
  jobId: string,
  actionId: string
): Promise<JobberGenericResponse<JobberRunner[]>> => {
  const result = await fetch(`/api/job/${jobId}/action/${actionId}/runners`);

  return await result.json();
};

export const deleteJobRunner = async (
  jobId: string,
  runnerId: string,
  graceful: boolean = true
): Promise<JobberGenericResponse> => {
  const result = await fetch(
    `/api/job/${jobId}/runners/${runnerId}?forceful=${
      graceful ? "false" : "true"
    }`,
    {
      method: "DELETE",
    }
  );

  return await result.json();
};
