import { eq } from "drizzle-orm";
import { Context, Hono, Next } from "hono";
import assert from "node:assert";
import { z } from "zod";
import { getConfigOption } from "~/config.js";
import { getDrizzle } from "~/db/index.js";
import { jobsTable } from "~/db/schema/jobs.js";
import { getUnixTimestamp } from "~/util.js";

type PrometheusQueryResponse =
  | {
      status: "success";
      data: {
        resultType: "matrix" | "vector";
        result: Array<{
          metric: Record<string, string>;
          values: Array<[number, string]>;
        }>;
      };
    }
  | {
      status: "error";
      errorType: string;
      error: string;
    };

type PrometheusQueryOptions = {
  // Prometheus query
  query: string;

  // end can be a number (Unix timestamp) or a string (rfc3339)
  start: number | string;

  // end can be a number (Unix timestamp) or a string (rfc3339)
  end: number | string;

  // Query resolution step width in duration format or float number of seconds.
  step: string;

  // Evaluation timeout. Optional. Defaults to and is capped by the value of the -query.timeout flag.
  timeout?: number;

  // Maximum number of returned series. Optional. 0 means disabled.
  limit?: number;
};

const queryPrometheus = async (options: PrometheusQueryOptions) => {
  const promUrl = getConfigOption("METRICS_PROMETHEUS_QUERY")!;

  const url = new URL(promUrl);

  url.searchParams.set("query", options.query);
  url.searchParams.set("start", String(options.start));
  url.searchParams.set("end", String(options.end));
  url.searchParams.set("step", options.step);

  if (options.timeout) {
    url.searchParams.set("timeout", String(options.timeout));
  }

  if (options.limit) {
    url.searchParams.set("limit", String(options.limit));
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  return (await response.json()) as PrometheusQueryResponse;
};

type MetricsResponse = {
  success: boolean;
  data: Array<{
    label: string;
    values: Array<{
      timestamp: number;
      value: number;
    }>;
  }>;
};

export async function createRouteJobMetrics() {
  const app = new Hono();

  const durationSchema = z.coerce.number().min(1).max(10000).default(900);

  const promUrl = getConfigOption("METRICS_PROMETHEUS_QUERY")!;
  const promJobName = getConfigOption("METRICS_PROMETHEUS_JOB_NAME")!;

  const middlewareValidatePrometheusConfig = async (c: Context, next: Next) => {
    if (!promUrl || !promJobName) {
      return c.json(
        {
          success: false,
          message: "Metrics are not configured",
        },
        500
      );
    }

    return next();
  };

  app.get(
    "/job/:jobId/metrics/:metric/:version",
    middlewareValidatePrometheusConfig,
    async (c, next) => {
      const jobId = c.req.param("jobId");
      let version = c.req.param("version");
      const metric = c.req.param("metric");
      const duration = await durationSchema.parseAsync(c.req.query("duration"));

      if (!jobId || !version || !metric) {
        return c.json(
          {
            success: false,
            message: "jobId, metric, and version are required",
          },
          400
        );
      }

      assert(typeof jobId === "string", "Job ID must be a string");
      assert(typeof version === "string", "Version must be a string");
      assert(typeof metric === "string", "Metric must be a string");

      const job = (
        await getDrizzle()
          .select()
          .from(jobsTable)
          .where(eq(jobsTable.id, jobId))
          .limit(1)
      )?.at(0);

      if (!job || job.version === null) {
        return c.json(
          {
            success: false,
            message: "Job not found",
          },
          404
        );
      }

      if (version === "latest") {
        version = job.version;
      }

      const jobIdEscaped = JSON.stringify(jobId);
      const versionEscaped = JSON.stringify(version);

      const durationString = `${
        getConfigOption("METRICS_PROMETHEUS_QUERY_STEP") * 2
      }s`;

      const queryMap: Record<string, { label: string; query: Array<string> }> =
        {
          /** jobber_runner_request_duration_sum */
          runner_request_duration: {
            label: `{job_name} @ {version}`,
            query: [
              `avg by (job_name, version) (`,
              `  rate(jobber_runner_request_duration_sum{job="${promJobName}", job_id=${jobIdEscaped}, version=${versionEscaped}}[${durationString}])`,
              `  /`,
              `  rate(jobber_runner_request_duration_count{job="${promJobName}", job_id=${jobIdEscaped}, version=${versionEscaped}}[${durationString}])`,
              `)`,
            ],
          },

          /** jobber_runner_startup_duration */
          runner_startup_duration: {
            label: `{job_name} @ {version}`,
            query: [
              `rate(jobber_runner_startup_duration_sum{job="${promJobName}", job_id=${jobIdEscaped}, version=${versionEscaped}}[${durationString}])`,
              `/`,
              `rate(jobber_runner_startup_duration_count{job="${promJobName}", job_id=${jobIdEscaped}, version=${versionEscaped}}[${durationString}])`,
            ],
          },

          /** jobber_runner_shutdown_duration */
          runner_shutdown_duration: {
            label: `{job_name} @ {version}`,
            query: [
              `rate(jobber_runner_shutdown_duration_sum{job="${promJobName}", job_id=${jobIdEscaped}, version=${versionEscaped}}[${durationString}])`,
              `/`,
              `rate(jobber_runner_shutdown_duration_count{job="${promJobName}", job_id=${jobIdEscaped}, version=${versionEscaped}}[${durationString}])`,
            ],
          },

          /** jobber_runner_active_runners */
          active_runners: {
            label: `{job_name} @ {version}`,
            query: [
              `jobber_active_runners{job="${promJobName}", job_id=${jobIdEscaped}, version=${versionEscaped}}`,
            ],
          },

          /** jobber_job_store */
          job_store: {
            label: `{job_name} @ {version}`,
            query: [
              `jobber_job_store{job="${promJobName}", job_id=${jobIdEscaped}, version=${versionEscaped}}`,
            ],
          },

          /** jobber_trigger_http_total */
          trigger_http_total: {
            label: `{status_code} {request_method} {request_path}`,
            query: [
              `increase(jobber_trigger_http_total{job="${promJobName}", job_id=${jobIdEscaped}, version=${versionEscaped}}[${durationString}])`,
            ],
          },

          /** jobber_trigger_cron_total */
          trigger_cron_total: {
            label: `{success}`,
            query: [
              `increase(jobber_trigger_cron_total{job="${promJobName}", job_id=${jobIdEscaped}, version=${versionEscaped}}[${durationString}])`,
            ],
          },

          /** jobber_trigger_mqtt_total */
          trigger_mqtt_total: {
            label: `{success}`,
            query: [
              `increase(jobber_trigger_mqtt_total{job="${promJobName}", job_id=${jobIdEscaped}, version=${versionEscaped}}[${durationString}])`,
            ],
          },

          /** jobber_trigger_mqtt_publish_total */
          trigger_mqtt_publish_total: {
            label: `{topic}`,
            query: [
              `increase(jobber_trigger_mqtt_publish_total{job="${promJobName}", job_id=${jobIdEscaped}, version=${versionEscaped}}[${durationString}])`,
            ],
          },

          /** jobber_runner_requests_total */
          runner_requests_total: {
            label: `{trigger_type}, status {success}`,
            query: [
              `increase(jobber_runner_requests_total{job="${promJobName}", job_id=${jobIdEscaped}, version=${versionEscaped}}[${durationString}])`,
            ],
          },
        };

      const queryItem = queryMap[metric];

      if (!queryItem) {
        return c.json(
          {
            success: false,
            message: `Metric "${metric}" is not supported`,
          },
          400
        );
      }

      const end = getUnixTimestamp();
      const start = end - duration;

      const result = await queryPrometheus({
        query: queryItem.query.join(""),
        start,
        end,
        step: `${getConfigOption("METRICS_PROMETHEUS_QUERY_STEP")}s`,
      });

      if (result.status === "error") {
        console.error(
          `Error querying Prometheus: ${result.errorType} - ${result.error}`
        );

        return c.json(
          {
            success: false,
            message: "Error querying Prometheus",
            error: result.error,
          },
          500
        );
      }

      assert(result.status === "success");
      assert(result.data.resultType === "matrix");

      return c.json<MetricsResponse>(
        {
          success: true,
          data: result.data.result.map((value) => {
            let label = queryItem.label;

            for (const [key, val] of Object.entries(value.metric)) {
              label = label.replace(`{${key}}`, val);
            }

            return {
              label: label,
              values: value.values.map(([timestamp, value]) => ({
                timestamp: Math.floor(Number(timestamp)),
                value: Number(value),
              })),
            };
          }),
        },
        200
      );
    }
  );

  return app;
}
