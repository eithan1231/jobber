import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { StatusCode } from "hono/utils/http-status";
import { mkdir } from "node:fs/promises";
import { ZodError } from "zod";

import { getPool, runDrizzleMigration } from "./db/index.js";
import { getJobActionArchiveDirectory } from "./paths.js";
import { getUnixTimestamp } from "./util.js";

import { DecoupledStatus } from "./jobber/decoupled-status.js";
import { LogDriverBase } from "./jobber/log-drivers/abstract.js";
import { createLogDriver } from "./jobber/log-drivers/index.js";
import { RunnerManager } from "./jobber/runners/manager.js";
import { HandleRequestHttp } from "./jobber/runners/server.js";
import { Store } from "./jobber/store.js";
import { Telemetry } from "./jobber/telemetry.js";
import { TriggerCron } from "./jobber/triggers/cron.js";
import { TriggerHttp } from "./jobber/triggers/http.js";
import { TriggerMqtt } from "./jobber/triggers/mqtt.js";

import { createRouteConfig } from "./routes/config.js";
import { createRouteJobActions } from "./routes/job/actions.js";
import { createRouteJobEnvironment } from "./routes/job/environment.js";
import { createRouteJob } from "./routes/job/job.js";
import { createRouteJobLogs } from "./routes/job/logs.js";
import { createRouteJobMetrics } from "./routes/job/metrics.js";
import { createRouteJobPublish } from "./routes/job/publish.js";
import { createRouteJobStore } from "./routes/job/store.js";
import { createRouteJobTriggers } from "./routes/job/triggers.js";
import { createRouteMetrics } from "./routes/metrics.js";
import { createRouteVersions } from "./routes/job/versions.js";
import { createRouteJobRunners } from "./routes/job/runners.js";

async function createInternalHono(instances: {
  runnerManager: RunnerManager;
  logger: LogDriverBase;
  decoupledStatus: DecoupledStatus;
  store: Store;
}) {
  const app = new Hono();

  app.onError(async (err, c) => {
    if (err instanceof ZodError) {
      if (
        err.errors.every(
          (issue) =>
            issue.path.at(0) === "request" &&
            (issue.path.at(1) === "body" ||
              issue.path.at(1) === "query" ||
              issue.path.at(1) === "param")
        )
      ) {
        return c.json({
          success: false,
          message: "Malformed request body",
          errors: err.errors.map(
            (issue) => `${issue.path.join(".")} - ${issue.message}`
          ),
        });
      }
    }

    console.error(err);

    return c.json(
      {
        success: false,
        message: "Internal Server Error",
      },
      500
    );
  });

  app.notFound(async (c) => {
    return c.json(
      {
        success: false,
        message: "Not Found",
      },
      404
    );
  });

  app.route("/api/", await createRouteJobActions(instances.runnerManager));
  app.route("/api/", await createRouteJobEnvironment());
  app.route("/api/", await createRouteJob());
  app.route("/api/", await createRouteJobRunners(instances.runnerManager));
  app.route("/api/", await createRouteJobMetrics());
  app.route("/api/", await createRouteJobLogs(instances.logger));
  app.route("/api/", await createRouteJobPublish());
  app.route("/api/", await createRouteJobStore(instances.store));
  app.route("/api/", await createRouteJobTriggers());
  app.route("/api/", await createRouteConfig());
  app.route("/api/", await createRouteVersions());

  app.route("/api/", await createRouteMetrics());

  app.get("/", async (c) => c.redirect("/jobber/"));

  app.use(
    "/*",
    serveStatic({
      root: "./public",
    })
  );

  app.use(
    "*",
    serveStatic({
      path: "index.html",
      root: "./public/",
    })
  );

  return app;
}

async function createGatewayHono(triggerHttp: TriggerHttp) {
  const app = new Hono();

  app.all("*", async (c, next) => {
    const bodyDirect = await c.req.arrayBuffer();

    const headers = c.req.header();
    const query = c.req.query();
    const queries = c.req.queries();
    const path = c.req.path;
    const method = c.req.method;
    const body = Buffer.from(bodyDirect);
    const bodyLength = body.length;

    const response = await triggerHttp.sendHandleRequest({
      body: body.toString("base64"),
      bodyLength,
      method,
      path,
      queries,
      query,
      headers,
    });

    if (!response) {
      return await next();
    }

    if (!response.success) {
      return c.json(
        {
          success: false,
          message: `Jobber: Gateway error!`,
        },
        502
      );
    }

    if (!response.http) {
      return c.json(
        {
          success: false,
          message: `Jobber: Gateway Error! No HTTP response received.`,
        },
        502
      );
    }

    return c.body(
      response.http.body,
      response.http.status as StatusCode,
      response.http.headers
    );
  });

  return app;
}

async function main() {
  const timestamp = getUnixTimestamp();

  console.log(
    "WARNING: This is an experimental runtime, and issues ARE expected! Report any issue, or raise a PR with a fix. Issues WILL be investigated and fixed."
  );

  console.log("[main] Initialising Database connection...");
  const dbPool = getPool();
  await dbPool.connect();
  console.log(`[main] done.`);

  console.log("[main] Applying database migrations...");
  if (!process.argv.includes("--skip-migrations")) {
    await runDrizzleMigration();
    console.log(`[main] done.`);
  } else {
    console.log(`[main] skipped.`);
  }

  console.log(`[main] Creating action-archive directory...`);
  await mkdir(getJobActionArchiveDirectory(), {
    recursive: true,
  });
  console.log(`[main] done.`);

  console.log(`[main] Initialising logger...`);
  const logger = await createLogDriver();
  await logger.start();
  console.log(`[main] done.`);

  console.log(`[main] Initialising decoupled status...`);
  const decoupledStatus = new DecoupledStatus();
  await decoupledStatus.start();
  console.log(`[main] done.`);

  console.log(`[main] Initialising store...`);
  const store = new Store();
  await store.start();
  console.log(`[main] done.`);

  console.log(`[main] Initialising runner manager...`);
  const runnerManager = new RunnerManager(store, logger);
  await runnerManager.start();
  console.log(`[main] done.`);

  console.log(`[main] Initialising triggers (Cron, MQTT, HTTP)...`);
  const triggerCron = new TriggerCron(runnerManager, logger, decoupledStatus);
  const triggerMqtt = new TriggerMqtt(runnerManager, logger, decoupledStatus);
  const triggerHttp = new TriggerHttp(runnerManager, logger, decoupledStatus);

  await Promise.all([
    triggerCron.start(),
    triggerMqtt.start(),
    triggerHttp.start(),
  ]);
  console.log(`[main] done.`);

  console.log(`[main] Initialising telemetry...`);
  const telemetry = new Telemetry(timestamp);
  await telemetry.start();
  console.log(`[main] done.`);

  console.log(`[main] Initialising APIs (API Internal, API Gateway)...`);
  const appInternal = await createInternalHono({
    runnerManager,
    logger,
    decoupledStatus,
    store,
  });
  const appGateway = await createGatewayHono(triggerHttp);

  const serverInternal = serve({
    port: 3000,
    fetch: appInternal.fetch,
  });

  const serverGateway = serve({
    port: 3001,
    fetch: appGateway.fetch,
  });

  serverInternal.once("listening", () => {
    console.log("[main] API Internal now listening");
  });

  serverGateway.once("listening", () => {
    console.log("[main] API Gateway now listening");
  });

  console.log(`[main] Application startup routine has completed.`);

  const signalRoutine = async () => {
    console.log(`[signalRoutine] Received shutdown signal.`);

    console.log(`[signalRoutine] Closing API Internal...`);
    serverInternal.close();
    console.log(`[signalRoutine] done.`);

    console.log(`[signalRoutine] Stopping all triggers.`);
    await Promise.all([
      triggerCron.stop(),
      triggerMqtt.stop(),
      triggerHttp.stop(),
    ]);
    console.log(`[signalRoutine] done.`);

    console.log(`[signalRoutine] Stopping runner manager.`);
    await runnerManager.stop();
    console.log(`[signalRoutine] done.`);

    console.log(`[signalRoutine] Stopping logger.`);
    await logger.stop();
    console.log(`[signalRoutine] done.`);

    console.log(`[signalRoutine] Stopping store.`);
    await store.stop();
    console.log(`[signalRoutine] done.`);

    console.log(`[signalRoutine] Closing API Gateway...`);
    serverGateway.close();
    console.log(`[signalRoutine] done.`);

    console.log(`[signalRoutine] Ending Database connection...`);
    const dbPool = getPool();
    /*await*/ dbPool.end(); // TODO: Look into why this hangs.
    console.log(`[signalRoutine] done.`);

    console.log(`[signalRoutine] Routine complete... Goodbye!`);

    process.exit(0);
  };

  process.once("SIGTERM", async () => {
    await signalRoutine();
  });

  process.once("SIGINT", async () => {
    await signalRoutine();
  });
}

main();
