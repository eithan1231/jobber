import { useEffect, useState } from "react";
import { getJobTriggers, JobberTrigger } from "../api/triggers";

export const useTriggers = (jobId: string) => {
  const [triggers, setTriggers] = useState<JobberTrigger[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reloadFlag, setReloadFlag] = useState(0);

  const handleUpdate = () => {
    getJobTriggers(jobId).then((res) => {
      if (!res.success) {
        setError("Failed to fetch triggers");

        console.error("Failed to fetch triggers", res.message);

        return;
      }

      setTriggers(res.data);
    });
  };

  const reload = () => {
    setReloadFlag((prev) => prev + 1);
  };

  useEffect(() => {
    handleUpdate();
  }, [jobId, reloadFlag]);

  return { triggers, triggersError: error, reloadTriggers: reload };
};
