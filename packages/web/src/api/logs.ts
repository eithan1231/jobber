import { JobberGenericResponse } from "./common";

export type JobberLogLine = {
  created: number;
  message: string;
};

export const getJobLogs = async (
  jobId: string
): Promise<JobberGenericResponse<JobberLogLine[]>> => {
  const result = await fetch(`/api/job/${jobId}/logs`);

  return await result.json();
};
