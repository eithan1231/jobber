import { useEffect, useState } from "react";
import { getOAuthSigningKeys, JobberOAuthSigningKey } from "../api/oauth-admin";

export const useSigningKeys = () => {
  const [signingKeys, setSigningKeys] = useState<
    JobberOAuthSigningKey[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadFlag, setReloadFlag] = useState(0);

  const handleUpdate = () => {
    getOAuthSigningKeys().then((res) => {
      if (!res.success) {
        setError("Failed to fetch signing keys");

        console.error("Failed to fetch signing keys", res.message);

        return;
      }

      setSigningKeys(res.data);
    });
  };

  const reload = () => {
    setReloadFlag((prev) => prev + 1);
  };

  useEffect(() => {
    handleUpdate();
  }, [reloadFlag]);

  return { signingKeys, signingKeysError: error, reloadSigningKeys: reload };
};
