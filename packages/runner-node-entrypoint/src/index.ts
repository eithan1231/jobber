import { randomBytes } from "crypto";
import { getArgument } from "./util.js";
import { Runner } from "./runner.js";
import assert from "assert";

const main = async () => {
  const jobRunnerIdentifier = getArgument("job-runner-identifier");
  const jobControllerHost = getArgument("job-controller-host");
  const jobControllerPort = Number(getArgument("job-controller-port"));

  assert(jobRunnerIdentifier);
  assert(jobControllerHost);
  assert(jobControllerPort);

  const jobber = new Runner(
    jobControllerHost,
    jobControllerPort,
    jobRunnerIdentifier
  );

  await jobber.connect();

  const shutdownRoutine = async () => {
    console.log("[main/shutdownRoutine] Received shutdown signal");

    await jobber.onFrameShutdown(randomBytes(16).toString("hex"));

    console.log("[main/shutdownRoutine] Finished! Goodbye!");
  };

  process.once("SIGTERM", async () => {
    await shutdownRoutine();
  });

  process.once("SIGINT", async () => {
    await shutdownRoutine();
  });
};

main();
