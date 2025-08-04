import { useEffect, useState } from "react";
import { getApiToken, JobberApiToken } from "../api/api-tokens";

export const useApiToken = (tokenId: string) => {
  const [apiToken, setApiToken] = useState<JobberApiToken | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadFlag, setReloadFlag] = useState(0);

  const handleUpdate = () => {
    getApiToken(tokenId).then((res) => {
      if (!res.success) {
        setError("Failed to fetch API token");

        console.error("Failed to fetch API token", res.message);

        return;
      }

      setApiToken(res.data);
    });
  };

  const reload = () => {
    setReloadFlag((prev) => prev + 1);
  };

  useEffect(() => {
    handleUpdate();
  }, [reloadFlag, tokenId]);

  return { apiToken, apiTokenError: error, reloadApiToken: reload };
};
