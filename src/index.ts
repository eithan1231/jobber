import { createHonoServer } from "./api.js";
import { JobController } from "./jobber/job-controller.js";
import { Job } from "./jobber/job.js";
import { timeout } from "./util.js";

const main = async () => {
  const jobController = new JobController();
  const job = new Job(jobController);

  console.log("[main] Starting job...");
  await job.start();
  console.log("[main] Started job.");

  console.log("[main] Starting job controller...");
  await timeout(50);
  await jobController.listen();
  console.log("[main] Started job controller.");

  const server = await createHonoServer(job);
  server.once("listening", () => {
    console.log("[main] API Server is listening");
  });

  process.once("SIGINT", async () => {
    await server.close();

    await job.stop();
    await jobController.close();
  });
};

main();
