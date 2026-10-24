import { useEffect, useState } from "react";
import { getConfig, JobberConfig } from "../api/config";

let configRequest: ReturnType<typeof getConfig> | null = null;

export const useConfig = () => {
  const [config, setConfig] = useState<JobberConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadFlag, setReloadFlag] = useState(0);

  const handleUpdate = () => {
    configRequest ??= getConfig();

    configRequest.then((res) => {
      if (!res.success) {
        configRequest = null;

        setError("Failed to fetch config");

        console.error("Failed to fetch config", res.message);

        return;
      }

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
