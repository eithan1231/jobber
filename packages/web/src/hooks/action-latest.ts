import { useEffect, useState } from "react";
import { getJobActionLatest, JobberAction } from "../api/jobber";

export const useActionLatest = (jobId: string) => {
  const [action, setAction] = useState<JobberAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadFlag, setReloadFlag] = useState(0);

  const handleUpdate = () => {
    getJobActionLatest(jobId).then((res) => {
      if (!res.success) {
        setError("Failed to fetch latest action");

        console.error("Failed to fetch latest action", res.message);

        return;
      }

      if (res.data.length >= 2) {
        throw new Error("More than one action found");
      }

      setAction(res.data[0]);
    });
  };

  const reload = () => {
    setReloadFlag((prev) => prev + 1);
  };

  useEffect(() => {
    handleUpdate();
  }, [jobId, reloadFlag]);

  return { action, actionError: error, reloadActionLatest: reload };
};
