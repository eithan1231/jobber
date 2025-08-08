import { useEffect, useState } from "react";
import { getUsers, JobberUser } from "../api/users";

export const useUsers = () => {
  const [users, setUsers] = useState<JobberUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadFlag, setReloadFlag] = useState(0);

  const handleUpdate = () => {
    getUsers().then((res) => {
      if (!res.success) {
        setError("Failed to fetch users");

        console.error("Failed to fetch users", res.message);

        return;
      }

      setUsers(res.data);
    });
  };

  const reload = () => {
    setReloadFlag((prev) => prev + 1);
  };

  useEffect(() => {
    handleUpdate();
  }, [reloadFlag]);

  return { users, usersError: error, reloadUsers: reload };
};
