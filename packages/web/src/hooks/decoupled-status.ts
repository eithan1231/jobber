import { useEffect, useState } from "react";
import { getDecoupledStatus, JobberDecoupledStatus } from "../api/jobber";

export const useDecoupledStatus = (keyName: string) => {
  const [message, setMessage] = useState<string | null>(null);
  const [level, setLevel] = useState<JobberDecoupledStatus["level"] | null>(
    null
  );
  const [reloadFlag, setReloadFlag] = useState(0);

  const handleUpdate = () => {
    getDecoupledStatus(keyName).then((result) => {
      if (!result.success) {
        return;
      }

      setMessage(result.data.message);
      setLevel(result.data.level);
    });
  };

  const reload = () => {
    setReloadFlag((prev) => prev + 1);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      handleUpdate();
    }, 1000);

    handleUpdate();

    return () => clearInterval(interval);
  }, [keyName, reloadFlag]);

  return { message, level, reloadDecoupledStatus: reload };
};
