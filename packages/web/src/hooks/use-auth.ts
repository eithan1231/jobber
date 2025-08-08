import { useEffect, useState } from "react";
import { getAuth, JobberAuth } from "../api/auth";

export const useAuth = () => {
  const [auth, setAuth] = useState<JobberAuth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadFlag, setReloadFlag] = useState(0);

  const handleUpdate = () => {
    getAuth().then((res) => {
      if (!res.success) {
        setError("Failed to fetch auth");

        console.error("Failed to fetch auth", res.message);

        return;
      }

      setAuth(res.data);
    });
  };

  const reload = () => {
    setReloadFlag((prev) => prev + 1);
  };

  useEffect(() => {
    handleUpdate();
  }, [reloadFlag]);

  return { auth, authError: error, reloadAuth: reload };
};
