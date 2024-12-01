import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { Job } from "./jobber/job.js";
import { createRouteJob } from "./routes/job.js";
import { ZodError } from "zod";

const createHonoApp = async (job: Job) => {
  const honoApp = new Hono();

  honoApp.onError(async (err, c) => {
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

  honoApp.notFound(async (c) => {
    return c.json(
      {
        success: false,
        message: "Page not found",
      },
      404
    );
  });

  honoApp.route("/api/job/", await createRouteJob(job));

  return honoApp;
};

const main = async () => {
  const job = new Job();

  console.log("[main] Starting job...");
  await job.start();
  console.log("[main] Started job.");

  const server = serve(await createHonoApp(job));

  server.once("listening", () => {
    console.log("[main] API Server is listening");
  });

  const signalRoutine = async () => {
    console.log(`[signalRoutine] Received shutdown signal.`);

    console.log(`[signalRoutine] Closing Hono Server.`);
    await server.close();

    console.log(`[signalRoutine] Closing Job.`);
    await job.stop();

    console.log(`[signalRoutine] Routine complete... Goodbye!`);
  };

  process.once("SIGTERM", async () => {
    await signalRoutine();
  });

  process.once("SIGINT", async () => {
    await signalRoutine();
  });
};

main();
