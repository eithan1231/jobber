import { useEffect, useState } from "react";
import { getDecoupledStatus, JobberDecoupledStatus } from "../api/jobber";

export const useDecoupledStatus = (keyName: string) => {
  const [message, setMessage] = useState<string | null>(null);
  const [level, setLevel] = useState<JobberDecoupledStatus["level"] | null>(
    null
  );

  const handleUpdate = () => {
    getDecoupledStatus(keyName).then((result) => {
      if (!result.success) {
        return;
      }

      setMessage(result.data.message);
      setLevel(result.data.level);
    });
  };

  useEffect(() => {
    const interval = setInterval(() => {
      handleUpdate();
    }, 1000);

    handleUpdate();

    return () => clearInterval(interval);
  }, []);

  return { message, level };
};
