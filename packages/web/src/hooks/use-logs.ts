import { useEffect, useState } from "react";
import { getJobLogs, JobberLogLine } from "../api/logs";

export const useLogs = (jobId: string) => {
  const [logs, setLogs] = useState<JobberLogLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reloadFlag, setReloadFlag] = useState(0);

  const handleUpdate = () => {
    getJobLogs(jobId).then((res) => {
      if (!res.success) {
        setError("Failed to fetch logs");

        console.error("Failed to fetch logs", res.message);

        return;
      }

      setLogs(res.data);
    });
  };

  const reload = () => {
    setReloadFlag((prev) => prev + 1);
  };

  useEffect(() => {
    handleUpdate();
  }, [jobId, reloadFlag]);

  return { logs, logsError: error, reloadLogs: reload };
};
