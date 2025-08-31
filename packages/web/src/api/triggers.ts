import { JobberGenericResponse } from "./common";

export type JobberTrigger = {
  id: string;
  jobId: string;
  /**
   * @deprecated Use `jobVersionId` instead.
   */
  version: string;
  jobVersionId: string;
  context:
    | {
        type: "schedule";
        name?: string;
        cron: string;
        timezone?: string;
      }
    | {
        type: "http";
        name?: string;
        path: string | null;
        method: string | null;
        hostname: string | null;
      }
    | {
        type: "mqtt";
        name?: string;
        topics: string[];
        connection: {
          protocol?: string;
          protocolVariable?: string;

          port?: string;
          portVariable?: string;

          host?: string;
          hostVariable?: string;

          username?: string;
          usernameVariable?: string;

          password?: string;
          passwordVariable?: string;

          clientId?: string;
          clientIdVariable?: string;
        };
      };

  status: {
    status: "unknown" | "unhealthy" | "healthy";
    message: string;
  };

  created: number;
};

export type JobberTriggerStatus = {
  status: "unknown" | "unhealthy" | "healthy";
  message: string;
};

export const getJobTriggers = async (
  jobId: string
): Promise<JobberGenericResponse<JobberTrigger[]>> => {
  const result = await fetch(`/api/job/${jobId}/triggers`);

  return await result.json();
};

export const getJobTriggersCurrent = async (
  jobId: string
): Promise<JobberGenericResponse<JobberTrigger[]>> => {
  const result = await fetch(`/api/job/${jobId}/triggers:current`);

  return await result.json();
};

export const getJobTriggerStatus = async (
  jobId: string,
  triggerId: string
): Promise<JobberGenericResponse<JobberTriggerStatus>> => {
  const result = await fetch(`/api/job/${jobId}/triggers/${triggerId}/status`);

  return await result.json();
};
