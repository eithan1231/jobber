import { useEffect, useState } from "react";
import { getMetricOverview, JobberMetricOverview } from "../api/metric";

export const useMetricOverview = () => {
  const [metricsOverview, setMetricsOverview] =
    useState<JobberMetricOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadFlag, setReloadFlag] = useState(0);

  const handleUpdate = () => {
    getMetricOverview().then((res) => {
      if (!res.success) {
        setError("Failed to fetch metric overview");

        console.error("Failed to fetch job metric overview", res.message);

        return;
      }

      setMetricsOverview(res.data);
    });
  };

  const reload = () => {
    setReloadFlag((prev) => prev + 1);
  };

  useEffect(() => {
    handleUpdate();
  }, [reloadFlag]);

  return {
    metricsOverview,
    metricsOverviewError: error,
    reloadMetricsOverview: reload,
  };
};
