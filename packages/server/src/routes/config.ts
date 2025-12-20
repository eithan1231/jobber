import { Hono } from "hono";
import { getConfigOption } from "~/config.js";

export async function createRouteConfig() {
  const app = new Hono();

  app.get("/config", async (c, next) => {
    return c.json({
      success: true,
      data: {
        jobberName: getConfigOption("JOBBER_NAME"),
        features: {
          metricsEnabled: getConfigOption("METRICS_PROMETHEUS_QUERY") !== null,
          actionDockerArgumentVolumesEnabled: getConfigOption(
            "RUNNER_ALLOW_DOCKER_ARGUMENT_TYPES"
          ).includes("volumes"),
          actionDockerArgumentNetworksEnabled: getConfigOption(
            "RUNNER_ALLOW_DOCKER_ARGUMENT_TYPES"
          ).includes("networks"),
          actionDockerArgumentLabelsEnabled: getConfigOption(
            "RUNNER_ALLOW_DOCKER_ARGUMENT_TYPES"
          ).includes("labels"),
          actionDockerArgumentMemoryLimitEnabled: getConfigOption(
            "RUNNER_ALLOW_DOCKER_ARGUMENT_TYPES"
          ).includes("memoryLimit"),
          actionDockerArgumentDirectPassthroughEnabled:
            getConfigOption("RUNNER_ALLOW_ARGUMENT_DIRECT_PASSTHROUGH") &&
            getConfigOption("RUNNER_ALLOW_DOCKER_ARGUMENT_TYPES").includes(
              "directPassthroughArguments"
            ),
        },
      },
    });
  });

  return app;
}
