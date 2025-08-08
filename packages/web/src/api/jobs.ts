import { JobberGenericResponse } from "./common";

export type JobberJob = {
  id: string;
  jobName: string;
  jobVersionId: string | null;
  description: string;
  links: Array<{ name: string; url: string }>;
  status: "enabled" | "disabled";

  /**
   * @deprecated use `jobVersionId` instead
   */
  version: string;
};

export const getJob = async (
  jobId: string
): Promise<JobberGenericResponse<JobberJob>> => {
  const result = await fetch(`/api/job/${jobId}`);

  return result.json();
};

export const getJobs = async (): Promise<
  JobberGenericResponse<JobberJob[]>
> => {
  const result = await fetch("/api/job/");

  return result.json();
};

export const updateJob = async (
  jobId: string,
  payload: Partial<Pick<JobberJob, "status" | "description" | "jobVersionId">>
): Promise<JobberGenericResponse<JobberJob[]>> => {
  const result = await fetch(`/api/job/${jobId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return result.json();
};

export const deleteJob = async (
  jobId: string
): Promise<JobberGenericResponse> => {
  const result = await fetch(`/api/job/${jobId}`, {
    method: "DELETE",
  });

  return result.json();
};
