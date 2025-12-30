import { HomePageComponent } from "../../components/home-page-component";
import { TimeSinceComponent } from "../../components/time-since-component";
import { useMetricOverview } from "../../hooks/use-metric-overview";
import { useJobs } from "../../hooks/use-jobs";
import { formatRelativeTime } from "../../util";
import { useEffect } from "react";
import { Doughnut } from "react-chartjs-2";

const Component = () => {
  const { metricsOverview, reloadMetricsOverview } = useMetricOverview();
  const { jobs } = useJobs();

  useEffect(() => {
    const interval = setInterval(() => {
      reloadMetricsOverview();
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const uptimeTimestamp =
    Math.floor(Date.now() / 1000) - (metricsOverview?.uptime ?? 0);

  const uptimeRelative = formatRelativeTime(uptimeTimestamp);

  // Calculate system health
  const totalRunners = metricsOverview?.runnerMetrics?.runnersTotal ?? 0;
  const enabledJobs = metricsOverview?.jobsMetrics?.jobsEnabled ?? 0;
  const totalJobs = metricsOverview?.jobsMetrics?.jobsTotal ?? 0;

  const systemHealth =
    totalJobs === 0
      ? "idle"
      : enabledJobs > 0 && totalRunners > 0
      ? "healthy"
      : enabledJobs > 0 && totalRunners === 0
      ? "degraded"
      : "idle";

  const healthConfig = {
    healthy: {
      bg: "bg-green-50 border-green-200",
      text: "text-green-800",
      message: "All systems operational",
    },
    degraded: {
      bg: "bg-yellow-50 border-yellow-200",
      text: "text-yellow-800",
      message: "System running with reduced capacity",
    },
    idle: {
      bg: "bg-blue-50 border-blue-200",
      text: "text-blue-800",
      message: "System idle - no active jobs",
    },
  };

  const health = healthConfig[systemHealth];

  // Chart data for runner status distribution
  const runnerStatusData = {
    labels: ["Ready", "Starting", "Closing", "Closed"],
    datasets: [
      {
        data: [
          metricsOverview?.runnerMetrics?.runnersReady ?? 0,
          metricsOverview?.runnerMetrics?.runnersStarting ?? 0,
          metricsOverview?.runnerMetrics?.runnersClosing ?? 0,
          metricsOverview?.runnerMetrics?.runnersClosed ?? 0,
        ],
        backgroundColor: [
          "rgb(34, 197, 94)",
          "rgb(251, 191, 36)",
          "rgb(251, 146, 60)",
          "rgb(156, 163, 175)",
        ],
        borderWidth: 0,
      },
    ],
  };

  // Sort jobs: enabled first, then disabled
  const sortedJobs =
    jobs?.slice().sort((a, b) => {
      if (a.status === "enabled" && b.status === "disabled") return -1;
      if (a.status === "disabled" && b.status === "enabled") return 1;
      return 0;
    }) ?? [];

  return (
    <HomePageComponent title="Dashboard">
      <div className="container mx-auto px-4 py-6">
        {/* System Health Banner */}
        <div
          className={`${health.bg} border rounded-lg p-4 mb-6 flex items-center gap-3`}
        >
          <div className="flex-1">
            <h2 className={`${health.text} font-semibold text-lg`}>
              Status:{" "}
              {systemHealth.charAt(0).toUpperCase() + systemHealth.slice(1)}
            </h2>
            <p className={`${health.text} text-sm opacity-90`}>
              {health.message}
            </p>
          </div>
          <div className="text-sm text-gray-600">Uptime: {uptimeRelative}</div>
        </div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* System Overview Chart */}
          <div className="lg:col-span-1 bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Runner Distribution
            </h3>
            <div
              className="flex items-center justify-center"
              style={{ height: "240px" }}
            >
              {totalRunners > 0 ? (
                <Doughnut
                  data={runnerStatusData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: "bottom",
                      },
                    },
                  }}
                />
              ) : (
                <div className="text-center text-gray-500">
                  <p className="text-sm">No active runners</p>
                </div>
              )}
            </div>
          </div>

          {/* Key Metrics */}
          <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
              <div className="text-sm font-medium text-gray-600 mb-1">
                Total Jobs
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {totalJobs}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {enabledJobs} enabled
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
              <div className="text-sm font-medium text-gray-600 mb-1">
                Total Runners
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {totalRunners}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {metricsOverview?.runnerMetrics?.runnersReady ?? 0} ready
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
              <div className="text-sm font-medium text-gray-600 mb-1">
                Runner Load
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {metricsOverview?.runnerMetrics?.runnersLoadTotal ?? 0}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {totalRunners > 0
                  ? `${(
                      (metricsOverview?.runnerMetrics?.runnersLoadTotal ?? 0) /
                      totalRunners
                    ).toFixed(1)} avg`
                  : "0 avg"}
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
              <div className="text-sm font-medium text-gray-600 mb-1">
                Last Request
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {metricsOverview?.runnerMetrics?.lastRequestAt ? (
                  <TimeSinceComponent
                    timestamp={
                      (metricsOverview?.runnerMetrics?.lastRequestAt ?? 0) - 2
                    }
                  />
                ) : (
                  <span className="text-gray-400">Never</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Active Jobs & Runners */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Active Jobs</h3>
            <p className="text-sm text-gray-600 mt-1">
              Jobs currently running or available
            </p>
          </div>

          {jobs && jobs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Job Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <a
                          href={`/job/${job.id}`}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800"
                        >
                          {job.jobName}
                        </a>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${
                            job.status === "enabled"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-md truncate">
                        {job.description || (
                          <span className="text-gray-400">No description</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <a
                          href={`/job/${job.id}`}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          View Details →
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-12 text-center">
              <div className="text-gray-400 mb-3">
                <svg
                  className="mx-auto h-12 w-12"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-1">
                No jobs configured
              </h4>
            </div>
          )}
        </div>
      </div>
    </HomePageComponent>
  );
};

export default Component;
