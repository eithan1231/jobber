import { useEffect, useState } from "react";
import { getJobRunners, JobberRunner } from "../api/runners";

export const useRunners = (jobId: string) => {
  const [runners, setRunners] = useState<JobberRunner[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reloadFlag, setReloadFlag] = useState(0);

  const handleUpdate = () => {
    getJobRunners(jobId).then((res) => {
      if (!res.success) {
        setError("Failed to fetch runners");

        console.error("Failed to fetch job runners", res.message);

        return;
      }

      setRunners(res.data);
    });
  };

  const reload = () => {
    setReloadFlag((prev) => prev + 1);
  };

  useEffect(() => {
    handleUpdate();
  }, [jobId, reloadFlag]);

  return { runners, runnersError: error, reloadRunners: reload };
};
