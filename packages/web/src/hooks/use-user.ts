import { useEffect, useState } from "react";
import { getUser, JobberUser } from "../api/users";

export const useUser = (userId: string) => {
  const [user, setUser] = useState<JobberUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadFlag, setReloadFlag] = useState(0);

  const handleUpdate = (userId: string) => {
    getUser(userId).then((res) => {
      if (!res.success) {
        setError("Failed to fetch user");

        console.error("Failed to fetch user", res.message);

        return;
      }

      setUser(res.data);
    });
  };

  const reload = () => {
    setReloadFlag((prev) => prev + 1);
  };

  useEffect(() => {
    handleUpdate(userId);
  }, [reloadFlag, userId]);

  return { user, userError: error, reloadUser: reload };
};
