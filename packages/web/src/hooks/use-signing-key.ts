import { useEffect, useState } from "react";
import { getOAuthSigningKey, JobberOAuthSigningKey } from "../api/oauth-admin";

export const useSigningKey = (keyId: string) => {
  const [signingKey, setSigningKey] = useState<JobberOAuthSigningKey | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [reloadFlag, setReloadFlag] = useState(0);

  const handleUpdate = () => {
    getOAuthSigningKey(keyId).then((res) => {
      if (!res.success) {
        setError("Failed to fetch signing key");

        console.error("Failed to fetch signing key", res.message);

        return;
      }

      setSigningKey(res.data);
    });
  };

  const reload = () => {
    setReloadFlag((prev) => prev + 1);
  };

  useEffect(() => {
    handleUpdate();
  }, [reloadFlag, keyId]);

  return { signingKey, signingKeyError: error, reloadSigningKey: reload };
};
