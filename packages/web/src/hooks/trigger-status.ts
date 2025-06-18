import { useEffect, useState } from "react";
import { getJobTriggerStatus, JobberTriggerStatus } from "../api/jobber";

export const useTriggerStatus = (jobId: string, triggerId: string) => {
  const [triggerStatus, setTriggerStatus] =
    useState<JobberTriggerStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadFlag, setReloadFlag] = useState(0);

  const handleUpdate = () => {
    getJobTriggerStatus(jobId, triggerId).then((res) => {
      if (!res.success) {
        setError("Failed to fetch triggers");

        console.error("Failed to fetch triggers", res.message);

        return;
      }

      setTriggerStatus(res.data);
    });
  };

  const reload = () => {
    setReloadFlag((prev) => prev + 1);
  };

  useEffect(() => {
    handleUpdate();
  }, [jobId, reloadFlag]);

  return {
    triggerStatus,
    triggerStatusError: error,
    reloadTriggerStatus: reload,
  };
};
