import { useParams } from "react-router-dom";
import { useJob } from "../../../hooks/use-job";
import { JobPageComponent } from "../../../components/job-page-component";
import { useEffect } from "react";

export const Component = () => {
  const { jobId } = useParams();

  if (!jobId) {
    return "Job ID is required";
  }

  const { job, jobError, reloadJob } = useJob(jobId);

  useEffect(() => {
    const reloader = () => {
      reloadJob();
    };

    reloader();

    const interval = setInterval(() => {
      reloader();
    }, 1000);

    return () => clearInterval(interval);
  }, [jobId]);

  if (!job && !jobError) {
    return "loading...";
  }

  if (!job) {
    return "Failed to load job";
  }

  if (jobError) {
    return `Failed to load job: ${jobError}`;
  }

  return (
    <JobPageComponent
      jobId={jobId}
      title={job.jobName}
      description={job.description}
    >
      <span className="text-gray-500">
        Job ID: {job.id} | Version: {job.jobVersionId || "None"}
      </span>
    </JobPageComponent>
  );
};

export default Component;
