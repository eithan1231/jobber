import { Counter, Gauge, Histogram } from "prom-client";

// Counter for job-http runs
export const counterTriggerHttp = new Counter({
  name: "jobber_trigger_http_total",
  help: "Counter for HTTP Trigger runs",
  labelNames: [
    "job_name",
    "job_id",
    "version",
    "method",
    "host",
    "path",
    "request_host",
    "request_method",
    "request_path",
    "status_code",
  ],
});

// Counter for trigger-cron runs
export const counterTriggerCron = new Counter({
  name: "jobber_trigger_cron_total",
  help: "Counter for Cron Trigger total runs",
  labelNames: ["job_name", "job_id", "version", "success"],
});

// Counter for trigger-mqtt runs
export const counterTriggerMqtt = new Counter({
  name: "jobber_trigger_mqtt_total",
  help: "Counter for MQTT Trigger total runs",
  labelNames: ["job_name", "job_id", "version", "success"],
});

// Counter for trigger-mqtt topic publishes
export const counterTriggerMqttPublish = new Counter({
  name: "jobber_trigger_mqtt_publish_total",
  help: "Counter for MQTT Trigger topic total publishes",
  labelNames: ["job_name", "job_id", "version", "topic"],
});

// Counter for runner requests
export const counterRunnerRequests = new Counter({
  name: "jobber_runner_requests_total",
  help: "Counter for runner total requests",
  labelNames: ["job_name", "job_id", "version", "trigger_type", "success"],
});

// Counter for the count of items in the job store
export const gaugeJobStoreCount = new Gauge({
  name: "jobber_job_store",
  help: "Gauge for job store item count",
  labelNames: ["job_name", "job_id", "version"],
});

// Gauge for active job runners
export const gaugeActiveRunners = new Gauge({
  name: "jobber_active_runners",
  help: "Gauge for active job runners",
  labelNames: ["job_name", "job_id", "version"],
});

// Histogram for the RunnerManager loop execution time
export const histogramJobManagerLoopDuration = new Histogram({
  name: "jobber_job_manager_loop_duration",
  help: "Histogram for job manager loop execution time",
  labelNames: ["jobber_name"],
  buckets: [0.025, 0.1, 0.5, 1, 2.5, 5, 10],
});

// Histogram for runner request duration
export const histogramRunnerRequestDuration = new Histogram({
  name: "jobber_runner_request_duration",
  help: "Histogram for runner request duration",
  labelNames: ["job_name", "job_id", "version", "trigger_type"],
  buckets: [1, 2.5, 5, 10],
});

// Histogram for runner startup duration
export const histogramRunnerStartupDuration = new Histogram({
  name: "jobber_runner_startup_duration",
  help: "Histogram for runner startup duration",
  labelNames: ["job_name", "job_id", "version"],
  buckets: [1, 2, 5, 10, 20, 30, 60, 120],
});

// Histogram for runner shutdown duration
export const histogramRunnerShutdownDuration = new Histogram({
  name: "jobber_runner_shutdown_duration",
  help: "Histogram for runner shutdown duration",
  labelNames: ["job_name", "job_id", "version"],
  buckets: [1, 2, 5, 10, 20, 30, 60, 120],
});

// Static application information metrics
export const gaugeAppInfo = new Gauge({
  name: "jobber_app_info",
  help: "Static application information metrics",
  labelNames: ["node_version", "platform", "arch", "start_time"],
});

// Jobs that exist in Jobber
export const gaugeJobsInfo = new Gauge({
  name: "jobber_jobs_info",
  help: "All jobs that exist in Jobber",
  labelNames: ["job_name", "job_id", "status"],
});
