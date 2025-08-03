import { useEffect, useState } from "react";
import { getJobVersions, JobberVersion } from "../api/versions";

export const useVersions = (jobId: string) => {
  const [versions, setVersions] = useState<JobberVersion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadFlag, setReloadFlag] = useState(0);

  const handleUpdate = () => {
    getJobVersions(jobId).then((res) => {
      if (!res.success) {
        setError("Failed to fetch versions");

        console.error("Failed to fetch versions", res.message);

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
  }, [reloadFlag]);

  return { versions, versionsError: error, reloadVersions: reload };
};
