import { randomBytes } from "crypto";
import { getArgument } from "./util.js";
import { Runner } from "./runner.js";
import assert from "assert";

const main = async () => {
  const jobRunnerIdentifier = getArgument("job-runner-identifier");
  const jobControllerHost = getArgument("job-controller-host");
  const jobControllerPort = Number(getArgument("job-controller-port"));
  const jobDebug = getArgument("job-debug") === "true";

  assert(jobRunnerIdentifier);
  assert(jobControllerHost);
  assert(jobControllerPort);

  if (jobDebug) {
    console.log("[main] Starting job runner with the following configuration:");
    console.log(`  Job Runner Identifier: ${jobRunnerIdentifier}`);
    console.log(`  Job Controller Host: ${jobControllerHost}`);
    console.log(`  Job Controller Port: ${jobControllerPort}`);
    console.log(`  Job Debug Mode: ${jobDebug ? "Enabled" : "Disabled"}`);
  }

  const jobber = new Runner(
    jobControllerHost,
    jobControllerPort,
    jobRunnerIdentifier,
    jobDebug
  );

  await jobber.connect();

  const shutdownRoutine = async () => {
    if (jobDebug) {
      console.log("[main/shutdownRoutine] Shutdown signal received");
    }

    await jobber.onFrameShutdown(randomBytes(16).toString("hex"));
  };

  process.once("SIGTERM", async () => {
    await shutdownRoutine();
  });

  process.once("SIGINT", async () => {
    await shutdownRoutine();
  });
};

main();
