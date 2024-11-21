import { JobController } from "./job-controller.js";
import { Job } from "./job.js";

const main = async () => {
  const jobController = new JobController();

  await jobController.listen();

  const job = new Job(jobController);

  await job.start();
};

main();
