import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { StatusCode } from "hono/utils/http-status";
import { mkdir } from "node:fs/promises";
import { ZodError } from "zod";

import { getPool, runDrizzleMigration } from "./db/index.js";
import { getJobActionArchiveDirectory } from "./paths.js";

import { LogDriverBase } from "./jobber/log-drivers/abstract.js";
import { createLogDriver } from "./jobber/log-drivers/index.js";
import { RunnerManager } from "./jobber/runners/manager.js";
import { HandleRequestHttp } from "./jobber/runners/server.js";
import { TriggerCron } from "./jobber/triggers/cron.js";
import { TriggerHttp } from "./jobber/triggers/http.js";
import { TriggerMqtt } from "./jobber/triggers/mqtt.js";

import { createRouteDeleteEnvironmentVariable } from "./routes/job/delete-environment-variable.js";
import { createRouteDeleteJob } from "./routes/job/delete-job.js";
import { createRouteGetActionRunners } from "./routes/job/get-action-runners.js";
import { createRouteGetActionsLatest } from "./routes/job/get-actions-latest.js";
import { createRouteGetActions } from "./routes/job/get-actions.js";
import { createRouteGetEnvironment } from "./routes/job/get-environment.js";
import { createRouteGetJobRunners } from "./routes/job/get-job-runners.js";
import { createRouteGetJob } from "./routes/job/get-job.js";
import { createRouteGetJobs } from "./routes/job/get-jobs.js";
import { createRouteGetLogs } from "./routes/job/get-logs.js";
import { createRouteGetTriggersLatest } from "./routes/job/get-triggers-latest.js";
import { createRouteGetTriggers } from "./routes/job/get-triggers.js";
import { createRoutePostEnvironmentVariable } from "./routes/job/post-environment-variable.js";
import { createRoutePostPublish } from "./routes/job/post-publish.js";

async function createInternalHono(instances: {
  runnerManager: RunnerManager;
  logger: LogDriverBase;
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

  app.route("/api/", await createRouteDeleteEnvironmentVariable());
  app.route("/api/", await createRouteDeleteJob());
  app.route(
    "/api/",
    await createRouteGetActionRunners(instances.runnerManager)
  );
  app.route("/api/", await createRouteGetActions());
  app.route("/api/", await createRouteGetActionsLatest());
  app.route("/api/", await createRouteGetEnvironment());
  app.route("/api/", await createRouteGetJob());
  app.route("/api/", await createRouteGetJobRunners(instances.runnerManager));
  app.route("/api/", await createRouteGetJobs());
  app.route("/api/", await createRouteGetLogs(instances.logger));
  app.route("/api/", await createRouteGetTriggers());
  app.route("/api/", await createRouteGetTriggersLatest());
  app.route("/api/", await createRoutePostEnvironmentVariable());
  app.route("/api/", await createRoutePostPublish());

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

  app.all(async (c, next) => {
    const bodyDirect = await c.req.arrayBuffer();

    const headers = c.req.header();
    const query = c.req.query();
    const queries = c.req.queries();
    const path = c.req.path;
    const method = c.req.method;
    const body = Buffer.from(bodyDirect);
    const bodyLength = body.length;

    const payload: HandleRequestHttp = {
      type: "http",
      body: body.toString("base64"),
      bodyLength,
      method,
      path,
      queries,
      query,
      headers,
    };

    const response = await triggerHttp.sendHandleRequest(payload);

    if (!response) {
      return await next();
    }

    if (!response.success) {
      return c.json(
        {
          success: false,
          message: `Jobber: Gateway error, ${response.error}`,
        },
        502
      );
    }

    if (!response.http) {
      return c.json(
        {
          success: false,
          message: `Jobber: Job did not return a HTTP response`,
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

  console.log(`[main] Initialising runner manager...`);
  const runnerManager = new RunnerManager(logger);
  await runnerManager.start();
  console.log(`[main] done.`);

  console.log(`[main] Initialising triggers (Cron, MQTT, HTTP)...`);
  const triggerCron = new TriggerCron(runnerManager);
  const triggerMqtt = new TriggerMqtt(runnerManager);
  const triggerHttp = new TriggerHttp(runnerManager);

  await Promise.all([
    triggerCron.start(),
    triggerMqtt.start(),
    triggerHttp.start(),
  ]);
  console.log(`[main] done.`);

  console.log(`[main] Initialising APIs (API Internal, API Gateway)...`);
  const appInternal = await createInternalHono({ runnerManager, logger });
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
