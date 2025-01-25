import { Counter } from "prom-client";

export const counterTriggerHttp = new Counter({
  name: "jobber_trigger_http",
  help: "Counter for HTTP Trigger runs",
  labelNames: [
    "job_name",
    "job_id",
    "version",
    "method",
    "host",
    "path",
    "status_code",
  ],
});

export const counterTriggerCron = new Counter({
  name: "jobber_trigger_cron",
  help: "Counter for Cron Trigger runs",
  labelNames: ["job_name", "job_id", "version", "success"],
});

export const counterTriggerMqtt = new Counter({
  name: "jobber_trigger_mqtt",
  help: "Counter for MQTT Trigger runs",
  labelNames: ["job_name", "job_id", "version", "success"],
});

export const counterRunnerRequests = new Counter({
  name: "jobber_runner_requests",
  help: "Counter for runner requests",
  labelNames: ["job_name", "job_id", "version", "trigger_type", "success"],
});
