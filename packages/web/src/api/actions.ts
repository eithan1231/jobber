import { JobberGenericResponse } from "./common";

export type JobberAction = {
  id: string;
  jobId: string;
  version: string;
  jobVersionId: string;
  runnerAsynchronous: boolean;
  runnerMinCount: number;
  runnerMaxCount: number;
  runnerTimeout: number;
  runnerMaxIdleAge: number;
  runnerMaxAge: number;
  runnerMaxAgeHard: number;
  runnerDockerArguments: {
    networks?: string[];
    volumes?: Array<{
      source: string;
      target: string;
      mode: "rw" | "ro";
    }>;
    labels?: Array<{
      key: string;
      value: string;
    }>;
    memoryLimit?: string; // e.g., "512m", "1g"
    directPassthroughArguments?: string[];
  };
  runnerMode: "standard" | "run-once";
};

export const getJobActions = async (
  jobId: string
): Promise<JobberGenericResponse<JobberAction[]>> => {
  const result = await fetch(`/api/job/${jobId}/actions`);

  return await result.json();
};

export const getJobActionCurrent = async (
  jobId: string
): Promise<JobberGenericResponse<JobberAction[]>> => {
  const result = await fetch(`/api/job/${jobId}/actions:current`);

  return await result.json();
};
