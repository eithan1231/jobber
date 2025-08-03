import { useEffect, useState } from "react";
import { getJobStore, JobberStoreItemPartial } from "../api/store";

export const useStore = (jobId: string) => {
  const [store, setStore] = useState<JobberStoreItemPartial[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadFlag, setReloadFlag] = useState(0);

  const handleUpdate = () => {
    getJobStore(jobId).then((res) => {
      if (!res.success) {
        setError("Failed to fetch store items");

        console.error("Failed to fetch store items", res.message);

        return;
      }

      setStore(res.data);
    });
  };

  const reload = () => {
    setReloadFlag((prev) => prev + 1);
  };

  useEffect(() => {
    handleUpdate();
  }, [reloadFlag]);

  return { store, storeError: error, reloadStore: reload };
};
