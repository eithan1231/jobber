import { useEffect, useState } from "react";
import { getJobVersions, JobberVersion } from "../api/jobber";

export const useVersions = (jobId: string) => {
  const [versions, setVersions] = useState<JobberVersion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reloadFlag, setReloadFlag] = useState(0);

  const handleUpdate = () => {
    getJobVersions(jobId).then((res) => {
      if (!res.success) {
        setError("Failed to fetch latest versions");

        console.error("Failed to fetch job versions", res.message);

        return;
      }

      setVersions(res.data);
    });
  };

  const reload = () => {
    setReloadFlag((prev) => prev + 1);
  };

  useEffect(() => {
    handleUpdate();
  }, [jobId, reloadFlag]);

  return { versions, versionsError: error, reloadVersions: reload };
};
