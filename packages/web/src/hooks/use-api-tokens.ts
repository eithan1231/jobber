import { useEffect, useState } from "react";
import { getApiTokens, JobberApiToken } from "../api/api-tokens";

export const useApiTokens = () => {
  const [apiTokens, setApiTokens] = useState<JobberApiToken[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadFlag, setReloadFlag] = useState(0);

  const handleUpdate = () => {
    getApiTokens().then((res) => {
      if (!res.success) {
        setError("Failed to fetch API tokens");

        console.error("Failed to fetch API tokens", res.message);

        return;
      }

      setApiTokens(res.data);
    });
  };

  const reload = () => {
    setReloadFlag((prev) => prev + 1);
  };

  useEffect(() => {
    handleUpdate();
  }, [reloadFlag]);

  return { apiTokens, apiTokensError: error, reloadApiTokens: reload };
};
