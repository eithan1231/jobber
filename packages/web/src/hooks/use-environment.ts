import { useEffect, useState } from "react";
import { getJobEnvironment, JobberEnvironment } from "../api/environment";

export const useEnvironment = (jobId: string) => {
  const [environment, setEnvironment] = useState<JobberEnvironment | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [reloadFlag, setReloadFlag] = useState(0);

  const handleUpdate = () => {
    getJobEnvironment(jobId).then((res) => {
      if (!res.success) {
        setError("Failed to fetch environment");

        console.error("Failed to fetch environment", res.message);

        return;
      }

      setEnvironment(res.data);
    });
  };

  const reload = () => {
    setReloadFlag((prev) => prev + 1);
  };

  useEffect(() => {
    handleUpdate();
  }, [jobId, reloadFlag]);

  return { environment, environmentError: error, reloadEnvironment: reload };
};
