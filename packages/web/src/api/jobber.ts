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
  status: "enabled" | "disabled";
  description: string;
  version?: string;
  jobVersionId?: string;
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

export type JobberStoreItem = {
  id: string;
  jobId: string;
  key: string;
  value: string;
  expiry?: number;
  modified: number;
  created: number;
};

export type JobberStoreItemNoValue = {
  id: string;
  jobId: string;
  key: string;
  expiry?: number;
  modified: number;
  created: number;
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
        path: string | null;
        method: string | null;
        hostname: string | null;
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

export type JobberDecoupledStatus = {
  level: "info" | "warn" | "error";
  message: string;
  created: number;
  updated: number;
  ttl?: number;
};

export type JobberMetricType =
  | "runner_request_duration"
  | "runner_startup_duration"
  | "runner_shutdown_duration"
  | "active_runners"
  | "job_store"
  | "trigger_http_total"
  | "trigger_cron_total"
  | "trigger_mqtt_total"
  | "trigger_mqtt_publish_total"
  | "runner_requests_total";

export type JobberMetricItem = {
  label: string;
  values: Array<{
    timestamp: number;
    value: number | null; // Allow null for missing values
  }>;
};

export type JobberConfig = {
  jobberName: string;
  features: {
    metricsEnabled: boolean;
  };
};

export type JobberVersion = {
  id: string;
  jobId: string;
  version: string;
  created: number;
  modified: number;
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

export const putJob = async (
  jobId: string,
  body: Partial<Pick<JobberJob, "status" | "description" | "jobVersionId">>
): Promise<JobberGenericResponse<undefined>> => {
  const result = await fetch(`/api/job/${jobId}`, {
    method: "PUT",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "text/json",
    },
  });

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

export const getJobVersions = async (
  jobId: string
): Promise<JobberGenericResponse<Array<JobberVersion>>> => {
  const result = await fetch(`/api/job/${jobId}/versions`);

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

export const getDecoupledStatus = async (
  key: string
): Promise<JobberGenericResponse<JobberDecoupledStatus>> => {
  const result = await fetch(`/api/decoupled-status/${key}`);

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

export const getJobStore = async (
  jobId: string
): Promise<JobberGenericResponse<JobberStoreItemNoValue[]>> => {
  const result = await fetch(`/api/job/${jobId}/store/`);
  return await result.json();
};

export const getJobStoreItem = async (
  jobId: string,
  storeId: string
): Promise<JobberGenericResponse<JobberStoreItem>> => {
  if (!storeId) {
    throw new Error("Store ID is required to fetch a store item.");
  }

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

export const getJobMetric = async (
  jobId: string,
  metric: JobberMetricType,
  version: string,
  duration?: number
): Promise<JobberGenericResponse<Array<JobberMetricItem>>> => {
  const result = await fetch(
    `/api/job/${jobId}/metrics/${metric}/${version}?duration=${duration ?? 900}`
  );

  return await result.json();
};

export const getConfig = async (): Promise<
  JobberGenericResponse<JobberConfig>
> => {
  const result = await fetch("/api/config");
  return await result.json();
};

export const postJobPublish = async () => {
  //
};
