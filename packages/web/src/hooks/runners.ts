import { useEffect, useState } from "react";
import { getJobRunners, JobberRunner } from "../api/jobber";

export const useRunners = (jobId: string) => {
  const [runners, setRunners] = useState<JobberRunner[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleUpdate = () => {
    getJobRunners(jobId).then((res) => {
      if (!res.success) {
        setError("Failed to fetch latest runners");

        console.error("Failed to fetch job runners", res.message);

        return;
      }

      setRunners(res.data);
    });
  };

  useEffect(() => {
    handleUpdate();
  }, [jobId]);

  return { runners, runnersError: error };
};
