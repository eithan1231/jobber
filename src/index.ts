import { createHonoServer } from "./api.js";
import { JobController } from "./jobber/job-controller.js";
import { Job } from "./jobber/job.js";

const main = async () => {
  const jobController = new JobController();
  await jobController.listen();

  console.log("[main] Job Controller has started");

  const job = new Job(jobController);
  await job.start();

  console.log("[main] Job has started");

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
