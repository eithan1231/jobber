import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import {
  compare as bcryptCompare,
  genSalt as bcryptGenSalt,
  hash as bcryptHash,
} from "bcryptjs";
import { Hono } from "hono";
import { StatusCode } from "hono/utils/http-status";
import { mkdir } from "node:fs/promises";
import { ZodError } from "zod";

import { getDrizzle, getPool, runDrizzleMigration } from "./db/index.js";
import { ApiTokensTableType } from "./db/schema/api-tokens.js";
import { SessionsTableType } from "./db/schema/sessions.js";
import {
  UserPasswordSchema,
  usersTable,
  UsersTableType,
  UserUsernameSchema,
} from "./db/schema/users.js";
import { getJobActionArchiveDirectory } from "./paths.js";
import { JobberPermissions, PERMISSION_SUPER } from "./permissions.js";
import { getUnixTimestamp } from "./util.js";

import { LogDriverBase } from "./jobber/log-drivers/abstract.js";
import { createLogDriver } from "./jobber/log-drivers/index.js";
import { RunnerManager } from "./jobber/runners/manager.js";
import { Store } from "./jobber/store.js";
import { Telemetry } from "./jobber/telemetry.js";
import { TriggerCron } from "./jobber/triggers/cron.js";
import { TriggerHttp } from "./jobber/triggers/http.js";
import { TriggerMqtt } from "./jobber/triggers/mqtt.js";

import { getConfigOption } from "./config.js";
import { cleanupLocks } from "./lock.js";
import { createRouteApiTokens } from "./routes/api-tokens.js";
import { createRouteAuth } from "./routes/auth.js";
import { createRouteConfig } from "./routes/config.js";
import { createRouteJobActions } from "./routes/job/actions.js";
import { createRouteJobEnvironment } from "./routes/job/environment.js";
import { createRouteJob } from "./routes/job/job.js";
import { createRouteJobLogs } from "./routes/job/logs.js";
import { createRouteJobMetrics } from "./routes/job/metrics.js";
import { createRouteJobPublish } from "./routes/job/publish.js";
import { createRouteJobRunners } from "./routes/job/runners.js";
import { createRouteJobStore } from "./routes/job/store.js";
import { createRouteJobTriggers } from "./routes/job/triggers.js";
import { createRouteVersions } from "./routes/job/versions.js";
import { createRouteMetrics } from "./routes/metrics.js";
import { createRouteUser } from "./routes/user.js";
import { eq } from "drizzle-orm";

export type InternalHonoApp = {
  Variables: {
    auth?:
      | {
          type: "session";
          user: UsersTableType;
          session: SessionsTableType;
          permissions: JobberPermissions;
        }
      | {
          type: "token";
          token: ApiTokensTableType;
          permissions: JobberPermissions;
        };
  };
};

async function createInternalHono(instances: {
  runnerManager: RunnerManager;
  logger: LogDriverBase;
  store: Store;
  triggerCron: TriggerCron;
  triggerHttp: TriggerHttp;
  triggerMqtt: TriggerMqtt;
}) {
  const app = new Hono<InternalHonoApp>();

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

  app.route("/api/", await createRouteApiTokens());
  app.route("/api/", await createRouteAuth());
  app.route("/api/", await createRouteUser());
  app.route("/api/", await createRouteJobActions(instances.runnerManager));
  app.route("/api/", await createRouteJobEnvironment());
  app.route("/api/", await createRouteJob());
  app.route("/api/", await createRouteJobRunners(instances.runnerManager));
  app.route("/api/", await createRouteJobMetrics());
  app.route("/api/", await createRouteJobLogs(instances.logger));
  app.route("/api/", await createRouteJobPublish());
  app.route("/api/", await createRouteJobStore(instances.store));
  app.route(
    "/api/",
    await createRouteJobTriggers(
      instances.triggerCron,
      instances.triggerHttp,
      instances.triggerMqtt
    )
  );
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

async function createStartupAccount() {
  const configUsername = getConfigOption("STARTUP_USERNAME");
  const configPassword = getConfigOption("STARTUP_PASSWORD");

  if (!configUsername || !configPassword) {
    console.log(
      "[createStartupAccount] No startup username or password configured. Skipping account creation."
    );

    return;
  }

  const parsedUsername = UserUsernameSchema.safeParse(configUsername);
  const parsedPassword = UserPasswordSchema.safeParse(configPassword);

  if (!parsedUsername.success || !parsedPassword.success) {
    console.error(
      "[createStartupAccount] Invalid startup username or password. Please check your configuration."
    );

    return;
  }

  const salt = await bcryptGenSalt(10);
  const hashedPassword = await bcryptHash(parsedPassword.data, salt);

  const user = await getDrizzle()
    .insert(usersTable)
    .values({
      username: parsedUsername.data,
      password: hashedPassword,
      permissions: PERMISSION_SUPER,
    })
    .onConflictDoNothing({
      where: eq(usersTable.username, parsedUsername.data),
    })
    .returning()
    .then((res) => res.at(0));

  if (!user) {
    console.log(
      "[createStartupAccount] User already exists or could not be created."
    );

    return;
  }

  console.log(
    `[createStartupAccount] Startup account created successfully: ${user.username}`
  );
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

  console.log(`[main] Starting db lock cleanup...`);
  await cleanupLocks();
  const lockCleanupInterval = setInterval(async () => {
    try {
      await cleanupLocks();
    } catch (err) {
      console.error("[main] Error during lock cleanup:", err);
    }
  }, 1000 * 60 * 5); // Every 5 minutes
  console.log(`[main] done.`);

  console.log(`[main] Creating startup account...`);
  await createStartupAccount();
  console.log(`[main] done.`);

  console.log(`[main] Initialising logger...`);
  const logger = await createLogDriver();
  await logger.start();
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
  const triggerCron = new TriggerCron(runnerManager, logger);
  const triggerMqtt = new TriggerMqtt(runnerManager, logger);
  const triggerHttp = new TriggerHttp(runnerManager, logger);

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
    store,
    triggerCron,
    triggerHttp,
    triggerMqtt,
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

    console.log(`[signalRoutine] Stopping telemetry.`);
    await telemetry.stop();
    console.log(`[signalRoutine] done.`);

    console.log(`[signalRoutine] Stopping db lock cleanup.`);
    clearInterval(lockCleanupInterval);
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
