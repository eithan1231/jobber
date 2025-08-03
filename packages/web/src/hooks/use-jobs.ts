import { useEffect, useState } from "react";
import { getJobs, JobberJob } from "../api/jobs";

export const useJobs = () => {
  const [jobs, setJobs] = useState<JobberJob[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadFlag, setReloadFlag] = useState(0);

  const handleUpdate = () => {
    getJobs().then((res) => {
      if (!res.success) {
        setError("Failed to fetch jobs");

        console.error("Failed to fetch jobs", res.message);

        return;
      }

      setJobs(res.data);
    });
  };

  const reload = () => {
    setReloadFlag((prev) => prev + 1);
  };

  useEffect(() => {
    handleUpdate();
  }, [reloadFlag]);

  return { jobs, jobsError: error, reloadJobs: reload };
};
