import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { JobPageComponent } from "../../../../components/job-page-component";
import { MetricMultipleComponent } from "../../../../components/metric-multiple-component";
import { useJob } from "../../../../hooks/use-job";

const METRICS_PERIODS = [
  { value: "60", label: "1 minute" },
  { value: "300", label: "5 minutes" },
  { value: "600", label: "10 minutes" },
  { value: "900", label: "15 minutes" },
  { value: "1800", label: "30 minutes" },
  { value: "3600", label: "1 hour" },
];

export const Component = () => {
  const { jobId } = useParams();

  if (!jobId) {
    return "Job ID is required";
  }

  const { job, jobError, reloadJob } = useJob(jobId);

  const [selectedPeriod, setSelectedPeriod] = useState("900");

  useEffect(() => {
    const reloader = () => {
      reloadJob();
    };

    reloader();

    const interval = setInterval(() => {
      reloader();
    }, 1000);

    return () => clearInterval(interval);
  }, [jobId]);

  if (!job && !jobError) {
    return "loading...";
  }

  if (!job) {
    return "Failed to load job";
  }

  if (jobError) {
    return `Failed to load job: ${jobError}`;
  }

  return (
    <JobPageComponent job={job}>
      <div className="container mx-auto my-8 p-4">
        <select
          onChange={(e) => {
            setSelectedPeriod(e.target.value);
          }}
        >
          {METRICS_PERIODS.map((period) => (
            <option
              key={period.value}
              value={period.value}
              selected={period.value === selectedPeriod}
            >
              {period.label}
            </option>
          ))}
        </select>
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-4">Requests</h2>
          <p className="text-sm text-gray-500 mb-2">
            This page displays various metrics related to the job, including
            request duration, active runners, and more.
          </p>
          <MetricMultipleComponent
            jobId={jobId}
            metricType="runner_requests_total"
            version="latest"
            autoUpdate={true}
            duration={selectedPeriod}
            showLegend={true}
          />
        </div>
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-2">Request Duration</h3>
          <p className="text-sm text-gray-500 mb-2">
            This metric shows the average duration of requests made by runners
            for this job.
          </p>
          <MetricMultipleComponent
            jobId={jobId}
            metricType="runner_request_duration"
            axisYSuffix="ms"
            version="latest"
            autoUpdate={true}
            duration={selectedPeriod}
          />
        </div>
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-2">Runners Active</h3>
          <p className="text-sm text-gray-500 mb-2">
            This metric shows the number of active runners for this job. A
            sudden spike may indicate a large number of jobs being processed or
            a sudden increase in load.
          </p>
          <MetricMultipleComponent
            jobId={jobId}
            metricType="active_runners"
            version="latest"
            autoUpdate={true}
            duration={selectedPeriod}
          />
        </div>
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-2">
            Runner Startup Duration
          </h3>
          <p className="text-sm text-gray-500 mb-2">
            This metric shows the duration it takes for a runner to start up
            after being created. Spikes may indicate abnormal load, large job
            archives, and more.
          </p>
          <MetricMultipleComponent
            jobId={jobId}
            metricType="runner_startup_duration"
            axisYSuffix="s"
            version="latest"
            autoUpdate={true}
            duration={selectedPeriod}
          />
        </div>
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-2">
            Runner Shutdown Duration
          </h3>
          <p className="text-sm text-gray-500 mb-2">
            This metric shows the duration it takes for a runner to shut down
            after receiving a shutdown signal. Spikes in this metric may
            indicate a runner is under load.
          </p>
          <MetricMultipleComponent
            jobId={jobId}
            metricType="runner_shutdown_duration"
            axisYSuffix="s"
            version="latest"
            autoUpdate={true}
            duration={selectedPeriod}
          />
        </div>
      </div>
    </JobPageComponent>
  );
};

export default Component;
