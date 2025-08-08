import { JobberGenericResponse } from "./common";

export type JobberVersion = {
  id: string;
  jobId: string;
  version: string;
  created: number;
  modified: number;
};

export const getJobVersions = async (
  jobId: string
): Promise<JobberGenericResponse<JobberVersion[]>> => {
  const result = await fetch(`/api/job/${jobId}/versions`);

  return result.json();
};
