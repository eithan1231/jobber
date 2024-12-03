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
  name: string;
  description: string;
  version?: string;
};

export type JobberLogLine = {
  runnerId: string;
  actionId: string;
  jobName: string;
  jobVersion: string;
  source: "STDOUT" | "STDERR";
  timestamp: number;
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
  jobName: string;
  version: string;
  runnerAsynchronous: boolean;
  runnerMinCount: number;
  runnerMaxCount: number;
  runnerMaxAge: number;
  runnerMaxAgeHard: number;
  runnerMode: "standard" | "run-once";
};

export type JobberTrigger = {
  id: string;
  jobName: string;
  version: string;
  context:
    | {
        type: "schedule";
        cron: string;
        timezone?: string;
      }
    | {
        type: "http";
      };
};

export const getJobs = async (): Promise<
  JobberGenericResponse<JobberJob[]>
> => {
  const result = await fetch("/api/job/");

  return await result.json();
};

export const getJob = async (
  jobName: string
): Promise<JobberGenericResponse<JobberJob>> => {
  const result = await fetch(`/api/job/${jobName}`);

  return await result.json();
};

export const deleteJob = async (
  jobName: string
): Promise<JobberGenericResponse> => {
  const result = await fetch(`/api/job/${jobName}`, {
    method: "DELETE",
  });

  return await result.json();
};

export const getJobEnvironment = async (
  jobName: string
): Promise<JobberGenericResponse<JobberEnvironment>> => {
  const result = await fetch(`/api/job/${jobName}/environment`);

  return await result.json();
};

export const createJobEnvironmentVariable = async (
  jobName: string,
  name: string,
  value: string,
  type: "text" | "secret"
): Promise<JobberGenericResponse> => {
  const form = new FormData();

  form.set("type", type);
  form.set("value", value);

  const result = await fetch(`/api/job/${jobName}/environment/${name}`, {
    method: "POST",
    body: form,
  });

  return await result.json();
};

export const deleteJobEnvironmentVariable = async (
  jobName: string,
  name: string
) => {
  const result = await fetch(`/api/job/${jobName}/environment/${name}`, {
    method: "DELETE",
  });

  return await result.json();
};

export const getJobActions = async (
  jobName: string
): Promise<JobberGenericResponse<JobberAction[]>> => {
  const result = await fetch(`/api/job/${jobName}/action`);

  return await result.json();
};

export const getJobActionLatest = async (
  jobName: string
): Promise<JobberGenericResponse<JobberAction>> => {
  const result = await fetch(`/api/job/${jobName}/action:latest`);

  return await result.json();
};

export const getJobTrigger = async (
  jobName: string
): Promise<JobberGenericResponse<JobberTrigger[]>> => {
  const result = await fetch(`/api/job/${jobName}/trigger`);

  return await result.json();
};

export const getJobTriggerLatest = async (
  jobName: string
): Promise<JobberGenericResponse<JobberTrigger[]>> => {
  const result = await fetch(`/api/job/${jobName}/trigger:latest`);

  return await result.json();
};

export const getJobLogs = async (
  jobName: string,
  filter: {
    message?: string;
  } = {}
): Promise<JobberGenericResponse<JobberLogLine[]>> => {
  const query = new URLSearchParams(filter);

  const result = await fetch(`/api/job/${jobName}/logs?${query.toString()}`);

  return await result.json();
};

export const runJob = async (
  jobName: string,
  opts: Pick<RequestInit, "headers" | "body" | "method">
) => {
  const result = await fetch(`/api/job/${jobName}/run`, {
    ...opts,
    redirect: "manual",
  });

  return await result.text();
};

export const postJobPublish = async () => {
  //
};
