import { RouteObject, useParams } from "react-router-dom";
import { JobHeaderComponent } from "../../../components/job-header.js";
import { useJob } from "../../../hooks/job.js";
import { MetricMultiple } from "../../../components/metric-multiple.js";

const Component = () => {
  const params = useParams();

  if (!params.jobId) {
    return "Job not found";
  }

  const { job } = useJob(params.jobId);

  if (!job) {
    return "Please wait, loading..";
  }

  return (
    <div>
      <JobHeaderComponent job={job} />

      <div className="container mx-auto my-8 p-4">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-4">Requests</h2>
          <p className="text-sm text-gray-500 mb-2">
            This page displays various metrics related to the job, including
            request duration, active runners, and more.
          </p>
          <MetricMultiple
            jobId={params.jobId}
            metricType="runner_requests_total"
            version="latest"
            autoUpdate={true}
            showLegend={true}
          />
        </div>

        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-2">Request Duration</h3>
          <p className="text-sm text-gray-500 mb-2">
            This metric shows the average duration of requests made by runners
            for this job.
          </p>
          <MetricMultiple
            jobId={params.jobId}
            metricType="runner_request_duration"
            axisYSuffix="ms"
            version="latest"
            autoUpdate={true}
          />
        </div>

        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-2">Runners Active</h3>
          <p className="text-sm text-gray-500 mb-2">
            This metric shows the number of active runners for this job. A
            sudden spike may indicate a large number of jobs being processed or
            a sudden increase in load.
          </p>
          <MetricMultiple
            jobId={params.jobId}
            metricType="active_runners"
            version="latest"
            autoUpdate={true}
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
          <MetricMultiple
            jobId={params.jobId}
            metricType="runner_startup_duration"
            axisYSuffix="s"
            version="latest"
            autoUpdate={true}
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
          <MetricMultiple
            jobId={params.jobId}
            metricType="runner_shutdown_duration"
            axisYSuffix="s"
            version="latest"
            autoUpdate={true}
          />
        </div>
      </div>
    </div>
  );
};

export const pagesJobberJobMetricsRoute: RouteObject = {
  path: "/jobber/:jobId/metrics",
  Component: Component,
};
