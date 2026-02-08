import { useEffect, useState } from "react";
import {
  getOAuthServiceClient,
  JobberOAuthServiceClient,
} from "../api/oauth-admin";

export const useServiceClient = (clientId: string) => {
  const [serviceClient, setServiceClient] =
    useState<JobberOAuthServiceClient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadFlag, setReloadFlag] = useState(0);

  const handleUpdate = () => {
    getOAuthServiceClient(clientId).then((res) => {
      if (!res.success) {
        setError("Failed to fetch service client");

        console.error("Failed to fetch service client", res.message);

        return;
      }

      setServiceClient(res.data);
    });
  };

  const reload = () => {
    setReloadFlag((prev) => prev + 1);
  };

  useEffect(() => {
    handleUpdate();
  }, [reloadFlag, clientId]);

  return {
    serviceClient,
    serviceClientError: error,
    reloadServiceClient: reload,
  };
};
