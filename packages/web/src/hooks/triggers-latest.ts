import { useEffect, useState } from "react";
import { getJobTriggersLatest, JobberTrigger } from "../api/jobber";

export const useTriggersLatest = (jobId: string) => {
  const [triggers, setTriggers] = useState<JobberTrigger[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleUpdate = () => {
    getJobTriggersLatest(jobId).then((res) => {
      if (!res.success) {
        setError("Failed to fetch latest triggers");

        console.error("Failed to fetch latest triggers", res.message);

        return;
      }

      setTriggers(res.data);
    });
  };

  useEffect(() => {
    handleUpdate();
  }, [jobId]);

  return { triggers, triggersError: error };
};
