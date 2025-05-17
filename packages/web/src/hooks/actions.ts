import { useEffect, useState } from "react";
import { getJobActions, JobberAction } from "../api/jobber";

export const useActions = (jobId: string) => {
  const [actions, setActions] = useState<JobberAction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reloadFlag, setReloadFlag] = useState(0);

  const handleUpdate = () => {
    getJobActions(jobId).then((res) => {
      if (!res.success) {
        setError("Failed to fetch actions");

        console.error("Failed to fetch actions", res.message);

        return;
      }

      setActions(res.data);
    });
  };

  const reload = () => {
    setReloadFlag((prev) => prev + 1);
  };

  useEffect(() => {
    handleUpdate();
  }, [jobId, reloadFlag]);

  return { actions, actionsError: error, reloadActions: reload };
};
