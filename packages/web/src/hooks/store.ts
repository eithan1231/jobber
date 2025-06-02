import { useEffect, useState } from "react";
import { getJobStore, JobberStoreItemNoValue } from "../api/jobber";

export const useStore = (jobId: string) => {
  const [store, setStore] = useState<JobberStoreItemNoValue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadFlag, setReloadFlag] = useState(0);

  const handleUpdate = () => {
    getJobStore(jobId).then((res) => {
      if (!res.success) {
        setError("Failed to fetch store");

        console.error("Failed to fetch store", res.message);

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
  }, [jobId, reloadFlag]);

  return {
    store: store,
    storeError: error,
    reloadStore: reload,
  };
};
