export type JobberGenericResponse<T = undefined> =
  | {
      success: true;
      message: string;
      data: T;
    }
  | {
      success: false;
      message: string;
    };

export type JobberJob = {
  id: string;
  jobName: string;
  description: string;
  version?: string;
  links: Array<{ name: string; url: string }>;
};

export type JobberLogLine = {
  created: number;
  message: string;
};

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

export type JobberAction = {
  id: string;
  jobId: string;
  version: string;
  runnerAsynchronous: boolean;
  runnerMinCount: number;
  runnerMaxCount: number;
  runnerTimeout: number;
  runnerMaxAge: number;
  runnerMaxAgeHard: number;
  runnerMode: "standard" | "run-once";
};

export type JobberTrigger = {
  id: string;
  jobId: string;
  version: string;
  context:
    | {
        type: "schedule";
        cron: string;
        timezone?: string;
      }
    | {
        type: "http";
        path: string[] | null;
        method: string[] | null;
        hostname: string[] | null;
      }
    | {
        type: "mqtt";
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
};

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

export const getJobs = async (): Promise<
  JobberGenericResponse<JobberJob[]>
> => {
  const result = await fetch("/api/job/");

  return await result.json();
};

export const getJob = async (
  jobId: string
): Promise<JobberGenericResponse<JobberJob>> => {
  const result = await fetch(`/api/job/${jobId}`);

  return await result.json();
};

export const deleteJob = async (
  jobId: string
): Promise<JobberGenericResponse> => {
  const result = await fetch(`/api/job/${jobId}`, {
    method: "DELETE",
  });

  return await result.json();
};

export const getJobEnvironment = async (
  jobId: string
): Promise<JobberGenericResponse<JobberEnvironment>> => {
  const result = await fetch(`/api/job/${jobId}/environment`);

  return await result.json();
};

export const createJobEnvironmentVariable = async (
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
) => {
  const result = await fetch(`/api/job/${jobId}/environment/${name}`, {
    method: "DELETE",
  });

  return await result.json();
};

export const getJobActions = async (
  jobId: string
): Promise<JobberGenericResponse<JobberAction[]>> => {
  const result = await fetch(`/api/job/${jobId}/actions`);

  return await result.json();
};

export const getJobActionLatest = async (
  jobId: string
): Promise<JobberGenericResponse<JobberAction[]>> => {
  const result = await fetch(`/api/job/${jobId}/actions:latest`);

  return await result.json();
};

export const getJobTriggers = async (
  jobId: string
): Promise<JobberGenericResponse<JobberTrigger[]>> => {
  const result = await fetch(`/api/job/${jobId}/triggers`);

  return await result.json();
};

export const getJobTriggersLatest = async (
  jobId: string
): Promise<JobberGenericResponse<JobberTrigger[]>> => {
  const result = await fetch(`/api/job/${jobId}/triggers:latest`);

  return await result.json();
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

export const getJobLogs = async (
  jobId: string
): Promise<JobberGenericResponse<JobberLogLine[]>> => {
  const result = await fetch(`/api/job/${jobId}/logs`);

  return await result.json();
};

export const runJob = async (
  jobId: string,
  opts: Pick<RequestInit, "headers" | "body" | "method">
) => {
  const result = await fetch(`/api/job/${jobId}/run`, {
    ...opts,
    redirect: "manual",
  });

  return await result.text();
};

export const postJobPublish = async () => {
  //
};
