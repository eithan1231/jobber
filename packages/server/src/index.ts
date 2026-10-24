import "reflect-metadata";

import { LogDriverBase } from "./jobber/log-drivers/abstract.js";
import "./jobber/log-drivers/index.js";
import { RunnerManager } from "./jobber/runners/manager.js";
import { Store } from "./jobber/store.js";
import { Telemetry } from "./jobber/telemetry.js";
import { TriggerCron } from "./jobber/triggers/cron.js";
import { TriggerMqtt } from "./jobber/triggers/mqtt.js";

import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { genSalt as bcryptGenSalt, hash as bcryptHash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { container } from "tsyringe";
import { ZodError } from "zod";

import { getDrizzle, getPool, runDrizzleMigration } from "./db/index.js";

import { PERMISSION_SUPER } from "@jobber/common/permissions.js";
import { getConfigOption } from "./config.js";
import { cleanupLocks } from "./lock.js";
import { ensureDirectoriesExist } from "./paths.js";

import { Bouncer } from "./bouncer.js";
import { USERNAME_ANONYMOUS } from "./constants.js";
import { usersTable } from "./db/schema.js";
import {
  JobsTableType,
  UserPasswordSchema,
  UserUsernameSchema,
} from "./db/types.js";
import { GrpcServer } from "./grpc/grpc-server.js";
import { PgBackup } from "./pg-backup.js";
import { RateLimit } from "./rate-limit.js";
import { createRouteApiTokens } from "./routes/api-tokens.js";
import { createRouteAuditLog } from "./routes/audit-log.js";
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
import { createRouteOAuthAdmin } from "./routes/oauth-admin.js";
import { createRouteOAuth } from "./routes/oauth.js";
import { createRouteSetup } from "./routes/setup.js";
import { createRouteUser } from "./routes/user.js";
import { seedsRun } from "./seeding/index.js";
import { OAuthServiceClients } from "./service-clients.js";
import { OAuthSigningKeys } from "./signing-keys.js";

export type InternalHonoApp = {
  Variables: {
    resourceLoader: {
      job: JobsTableType;
    };

    bouncer: Bouncer;
  };
};

async function createInternalHono() {
  const app = new Hono<InternalHonoApp>();

  app.onError(async (err, c) => {
    if (err instanceof ZodError) {
      if (
        err.errors.every(
          (issue) =>
            issue.path.at(0) === "request" &&
            (issue.path.at(1) === "body" ||
              issue.path.at(1) === "query" ||
              issue.path.at(1) === "param"),
        )
      ) {
        return c.json({
          success: false,
          message: "Malformed request body",
          errors: err.errors.map(
            (issue) => `${issue.path.join(".")} - ${issue.message}`,
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
      500,
    );
  });

  app.notFound(async (c) => {
    return c.json(
      {
        success: false,
        message: "Not Found",
      },
      404,
    );
  });

  app.route("/api/", await createRouteApiTokens());
  app.route("/api/", await createRouteAuditLog());
  app.route("/api/", await createRouteAuth());
  app.route("/api/", await createRouteConfig());
  app.route("/api/", await createRouteJob());
  app.route("/api/", await createRouteJobActions());
  app.route("/api/", await createRouteJobEnvironment());
  app.route("/api/", await createRouteJobLogs());
  app.route("/api/", await createRouteJobMetrics());
  app.route("/api/", await createRouteJobPublish());
  app.route("/api/", await createRouteJobRunners());
  app.route("/api/", await createRouteJobStore());
  app.route("/api/", await createRouteJobTriggers());
  app.route("/api/", await createRouteMetrics());
  app.route("/api/", await createRouteOAuthAdmin());
  app.route("/api/", await createRouteSetup());
  app.route("/api/", await createRouteUser());
  app.route("/api/", await createRouteVersions());

  // Not within /api/ for compliance with OAuth 2.0 best practices.
  app.route("/", await createRouteOAuth());

  app.get("/", async (c) => c.redirect("/home/"));

  app.use(
    "/*",
    serveStatic({
      root: "./public",
    }),
  );

  app.use(
    "*",
    serveStatic({
      path: "index.html",
      root: "./public/",
    }),
  );

  return app;
}

async function createAnonymousAccount() {
  await getDrizzle()
    .insert(usersTable)
    .values({
      username: USERNAME_ANONYMOUS,
      password: "", // No password, should be hashed. Login will always fail.
      enabled: false,
      permissions: [
        {
          effect: "deny",
          actions: ["read", "write", "delete"],
          resource: "*",
        },
      ],
    })
    .onConflictDoNothing({
      where: eq(usersTable.username, USERNAME_ANONYMOUS),
    });
}

async function main() {
  console.log(
    "WARNING: This is an experimental runtime, and issues ARE expected! Report any issue, or raise a PR with a fix. Issues WILL be investigated and fixed.",
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

  console.log(`[main] Creating directories...`);
  ensureDirectoriesExist();
  console.log(`[main] done.`);
  console.log(`[main] Starting db lock cleanup...`);
  await cleanupLocks();
  const lockCleanupInterval = setInterval(
    async () => {
      try {
        await cleanupLocks();
      } catch (err) {
        console.error("[main] Error during lock cleanup:", err);
      }
    },
    1000 * 60 * 5,
  ); // Every 5 minutes
  console.log(`[main] done.`);

  console.log(`[main] Creating anonymous account...`);
  await createAnonymousAccount();
  console.log(`[main] done.`);

  console.log("[main] Initialising OAuth Signing Keys...");
  const oauthSigningKeys = container.resolve(OAuthSigningKeys);
  await oauthSigningKeys.start();
  console.log(`[main] done.`);

  console.log("[main] Initialising OAuth Service Clients...");
  const oauthServiceClients = container.resolve(OAuthServiceClients);
  oauthServiceClients.start();
  console.log(`[main] done.`);

  console.log("[main] Starting pg backup service...");
  const pgBackup = container.resolve(PgBackup);
  await pgBackup.start();
  console.log(`[main] done.`);

  console.log(`[main] Initialising logger...`);
  const logger = container.resolve<LogDriverBase>("LogDriverBase");
  await logger.start();
  console.log(`[main] done.`);

  console.log(`[main] Initialising store...`);
  const store = container.resolve(Store);
  await store.start();
  console.log(`[main] done.`);

  console.log(`[main] Initialising runner manager...`);
  const runnerManager = container.resolve(RunnerManager);
  await runnerManager.start();
  console.log(`[main] done.`);

  console.log(`[main] Initialising triggers (Cron, MQTT, HTTP)...`);
  const triggerCron = container.resolve(TriggerCron);
  const triggerMqtt = container.resolve(TriggerMqtt);

  await Promise.all([triggerCron.start(), triggerMqtt.start()]);
  console.log(`[main] done.`);

  // console.log(`[main] Registering MQTT Publish Handler...`);
  // runnerManager.registerMqttPublishHandler((...args) =>
  //   triggerMqtt.publishMqttMessage(...args),
  // );
  // console.log(`[main] done.`);

  console.log(`[main] Initialising rate limiter...`);
  const rateLimit = container.resolve(RateLimit);
  await rateLimit.start();
  console.log(`[main] done.`);

  console.log(`[main] Initialising telemetry...`);
  const telemetry = container.resolve(Telemetry);
  await telemetry.start();
  console.log(`[main] done.`);

  console.log("[main] Initialising gRPC server...");
  const grpcServer = container.resolve(GrpcServer);
  await grpcServer.start();
  console.log("[main] done.");

  console.log(`[main] Initialising APIs (API Internal, API Gateway)...`);
  const appInternal = await createInternalHono();

  const serverInternal = serve({
    port: getConfigOption("API_PORT"),
    fetch: appInternal.fetch,
  });

  console.log(`[main] done.`);

  console.log(`[main] Running seeds...`);
  await seedsRun();
  console.log(`[main] done.`);

  serverInternal.once("listening", () => {
    console.log("[main] API Internal now listening");
  });

  console.log(`[main] Application startup routine has completed.`);

  const signalRoutine = async () => {
    console.log(`[signalRoutine] Received shutdown signal.`);

    console.log(`[signalRoutine] Closing API Internal...`);
    serverInternal.close();
    console.log(`[signalRoutine] done.`);

    console.log(`[signalRoutine] Stopping all triggers.`);
    await Promise.all([triggerCron.stop(), triggerMqtt.stop()]);
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

    console.log("[signalRoutine] Stopping gRPC server.");
    await grpcServer.stop();
    console.log("[signalRoutine] done.");

    console.log(`[signalRoutine] Stopping pg backup service.`);
    await pgBackup.stop();
    console.log(`[signalRoutine] done.`);

    console.log(`[signalRoutine] Stopping logger.`);
    await logger.stop();
    console.log(`[signalRoutine] done.`);

    console.log(`[signalRoutine] Stopping store.`);
    await store.stop();
    console.log(`[signalRoutine] done.`);

    console.log(`[signalRoutine] Stopping rate limiter...`);
    await rateLimit.stop();
    console.log(`[signalRoutine] done.`);

    console.log(`[signalRoutine] Stopping OAuth Service Clients...`);
    await oauthServiceClients.stop();
    console.log(`[signalRoutine] done.`);

    console.log(`[signalRoutine] Stopping OAuth Signing Keys...`);
    await oauthSigningKeys.stop();
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
