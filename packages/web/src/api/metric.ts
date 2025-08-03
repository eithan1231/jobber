import { JobberGenericResponse } from "./common";

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

export const getJobMetric = async (
  jobId: string,
  metric: JobberMetricType,
  version: string,
  duration?: number
): Promise<JobberGenericResponse<Array<JobberMetricItem>>> => {
  console.log("asasas");
  const result = await fetch(
    `/api/job/${jobId}/metrics/${metric}/${version}?duration=${duration ?? 900}`
  );

  return await result.json();
};
