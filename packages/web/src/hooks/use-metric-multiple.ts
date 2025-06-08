import { useEffect, useState } from "react";
import {
  getJobMetric,
  JobberMetricItem,
  JobberMetricType,
} from "../api/jobber";

export const useMetricMultiple = (
  jobId: string,
  metricType: JobberMetricType,
  version?: string,
  duration?: string
) => {
  const [data, setData] = useState<JobberMetricItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadFlag, setReloadFlag] = useState(0);

  const handleUpdate = () => {
    getJobMetric(
      jobId,
      metricType,
      version ?? "latest",
      Number(duration ?? 900)
    ).then((res) => {
      if (!res.success) {
        setError(`Failed to fetch metric ${metricType}`);

        console.error(`Failed to fetch metric ${metricType}`, res.message);

        return;
      }

      setData(res.data);
    });
  };

  const reload = () => {
    setReloadFlag((prev) => prev + 1);
  };

  useEffect(() => {
    handleUpdate();
  }, [reloadFlag]);

  return {
    dataMetric: data,
    dataMetricError: error,
    reloadMetric: reload,
  };
};
