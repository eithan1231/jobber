import { useEffect, useState } from "react";
import {
  getOAuthServiceClients,
  JobberOAuthServiceClient,
} from "../api/oauth-admin";

export const useServiceClients = () => {
  const [serviceClients, setServiceClients] = useState<
    JobberOAuthServiceClient[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadFlag, setReloadFlag] = useState(0);

  const handleUpdate = () => {
    getOAuthServiceClients().then((res) => {
      if (!res.success) {
        setError("Failed to fetch service clients");

        console.error("Failed to fetch service clients", res.message);

        return;
      }

      setServiceClients(res.data);
    });
  };

  const reload = () => {
    setReloadFlag((prev) => prev + 1);
  };

  useEffect(() => {
    handleUpdate();
  }, [reloadFlag]);

  return {
    serviceClients,
    serviceClientsError: error,
    reloadServiceClients: reload,
  };
};
