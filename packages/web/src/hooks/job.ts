import { useEffect, useState } from "react";
import { getJob, JobberJob } from "../api/jobber";

export const useJob = (jobId: string) => {
  const [job, setJob] = useState<JobberJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadFlag, setReloadFlag] = useState(0);

  const handleUpdate = () => {
    getJob(jobId).then((res) => {
      if (!res.success) {
        setError("Failed to fetch job");

        console.error("Failed to fetch job", res.message);

        return;
      }

      setJob(res.data);
    });
  };

  const reload = () => {
    setReloadFlag((prev) => prev + 1);
  };

  useEffect(() => {
    handleUpdate();
  }, [jobId, reloadFlag]);

  return { job, jobError: error, reloadJob: reload };
};
