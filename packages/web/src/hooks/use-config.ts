import { useEffect, useState } from "react";
import { getConfig, JobberConfig } from "../api/config";

let cachedConfig: JobberConfig | null = null;

export const useConfig = () => {
  const [config, setConfig] = useState<JobberConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadFlag, setReloadFlag] = useState(0);

  const handleUpdate = () => {
    if (cachedConfig) {
      setConfig(cachedConfig);
      return;
    }

    getConfig().then((res) => {
      if (!res.success) {
        setError("Failed to fetch config");

        console.error("Failed to fetch config", res.message);

        return;
      }

      cachedConfig = res.data;
      setConfig(res.data);
    });
  };

  const reload = () => {
    setReloadFlag((prev) => prev + 1);
  };

  useEffect(() => {
    handleUpdate();
  }, [reloadFlag]);

  return { config, configError: error, reloadConfig: reload };
};
