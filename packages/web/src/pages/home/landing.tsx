import { HomePageComponent } from "../../components/home-page-component";
import { TimeSinceComponent } from "../../components/time-since-component";
import { useMetricOverview } from "../../hooks/use-metric-overview";
import { formatRelativeTime } from "../../util";

const Component = () => {
  const { metricsOverview } = useMetricOverview();

  const uptimeTimestamp =
    Math.floor(Date.now() / 1000) - (metricsOverview?.uptime ?? 0);

  const uptimeRelative = formatRelativeTime(uptimeTimestamp);

  return (
    <HomePageComponent title="Homepage">
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-4">Welcome to the Homepage</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
          <div
            className="group rounded-xl border border-gray-200 bg-white/70 backdrop-blur-sm p-5 shadow-sm transition hover:shadow-md"
            aria-label="Total jobs metric"
          >
            <div className="flex items-start justify-between">
              <span className="text-sm font-medium text-gray-500">Uptime</span>
            </div>
            <div
              className="mt-3 flex items-end gap-2"
              title={new Date(uptimeTimestamp * 1000).toLocaleString()}
            >
              <span className="text-3xl font-semibold text-gray-900">
                {uptimeRelative}
              </span>
            </div>
          </div>

          <div
            className="group rounded-xl border border-gray-200 bg-white/70 backdrop-blur-sm p-5 shadow-sm transition hover:shadow-md"
            aria-label="Total jobs metric"
          >
            <div className="flex items-start justify-between">
              <span className="text-sm font-medium text-gray-500">
                Jobs Total
              </span>
            </div>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-3xl font-semibold text-gray-900">
                {metricsOverview?.jobsMetrics?.jobsTotal ?? "-"}
              </span>
            </div>
          </div>

          {(metricsOverview?.jobsMetrics?.jobsDisabled ?? 0) > 0 && (
            <div
              className="group rounded-xl border border-gray-200 bg-white/70 backdrop-blur-sm p-5 shadow-sm transition hover:shadow-md"
              aria-label="Total jobs metric"
            >
              <div className="flex items-start justify-between">
                <span className="text-sm font-medium text-gray-500">
                  Jobs Disabled
                </span>
              </div>
              <div className="mt-3 flex items-end gap-2">
                <span className="text-3xl font-semibold text-gray-900">
                  {metricsOverview?.jobsMetrics?.jobsDisabled ?? "-"}
                </span>
              </div>
            </div>
          )}

          {(metricsOverview?.jobsMetrics?.jobsEnabled ?? 0) > 0 && (
            <div
              className="group rounded-xl border border-gray-200 bg-white/70 backdrop-blur-sm p-5 shadow-sm transition hover:shadow-md"
              aria-label="Total jobs metric"
            >
              <div className="flex items-start justify-between">
                <span className="text-sm font-medium text-gray-500">
                  Jobs Enabled
                </span>
              </div>
              <div className="mt-3 flex items-end gap-2">
                <span className="text-3xl font-semibold text-gray-900">
                  {metricsOverview?.jobsMetrics?.jobsEnabled ?? "-"}
                </span>
              </div>
            </div>
          )}

          <div
            className="group rounded-xl border border-gray-200 bg-white/70 backdrop-blur-sm p-5 shadow-sm transition hover:shadow-md"
            aria-label="Runners total metric"
          >
            <div className="flex items-start justify-between">
              <span className="text-sm font-medium text-gray-500">
                Runners Total
              </span>
            </div>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-3xl font-semibold text-gray-900">
                {metricsOverview?.runnerMetrics?.runnersTotal ?? "-"}
              </span>
            </div>
          </div>

          {(metricsOverview?.runnerMetrics?.runnersStarting ?? 0) > 0 && (
            <div
              className="group rounded-xl border border-gray-200 bg-white/70 backdrop-blur-sm p-5 shadow-sm transition hover:shadow-md"
              aria-label="Runners total metric"
            >
              <div className="flex items-start justify-between">
                <span className="text-sm font-medium text-gray-500">
                  Runners Starting
                </span>
              </div>
              <div className="mt-3 flex items-end gap-2">
                <span className="text-3xl font-semibold text-gray-900">
                  {metricsOverview?.runnerMetrics?.runnersStarting ?? "-"}
                </span>
              </div>
            </div>
          )}

          {(metricsOverview?.runnerMetrics?.runnersReady ?? 0) > 0 && (
            <div
              className="group rounded-xl border border-gray-200 bg-white/70 backdrop-blur-sm p-5 shadow-sm transition hover:shadow-md"
              aria-label="Runners total metric"
            >
              <div className="flex items-start justify-between">
                <span className="text-sm font-medium text-gray-500">
                  Runners Ready
                </span>
              </div>
              <div className="mt-3 flex items-end gap-2">
                <span className="text-3xl font-semibold text-gray-900">
                  {metricsOverview?.runnerMetrics?.runnersReady ?? "-"}
                </span>
              </div>
            </div>
          )}

          {(metricsOverview?.runnerMetrics?.runnersClosing ?? 0) > 0 && (
            <div
              className="group rounded-xl border border-gray-200 bg-white/70 backdrop-blur-sm p-5 shadow-sm transition hover:shadow-md"
              aria-label="Runners total metric"
            >
              <div className="flex items-start justify-between">
                <span className="text-sm font-medium text-gray-500">
                  Runners Closing
                </span>
              </div>
              <div className="mt-3 flex items-end gap-2">
                <span className="text-3xl font-semibold text-gray-900">
                  {metricsOverview?.runnerMetrics?.runnersClosing ?? "-"}
                </span>
              </div>
            </div>
          )}

          {(metricsOverview?.runnerMetrics?.runnersClosed ?? 0) > 0 && (
            <div
              className="group rounded-xl border border-gray-200 bg-white/70 backdrop-blur-sm p-5 shadow-sm transition hover:shadow-md"
              aria-label="Runners total metric"
            >
              <div className="flex items-start justify-between">
                <span className="text-sm font-medium text-gray-500">
                  Runners Closed
                </span>
              </div>
              <div className="mt-3 flex items-end gap-2">
                <span className="text-3xl font-semibold text-gray-900">
                  {metricsOverview?.runnerMetrics?.runnersClosed ?? "-"}
                </span>
              </div>
            </div>
          )}

          {(metricsOverview?.runnerMetrics?.runnersLoadTotal ?? 0) > 0 && (
            <div
              className="group rounded-xl border border-gray-200 bg-white/70 backdrop-blur-sm p-5 shadow-sm transition hover:shadow-md"
              aria-label="Runners total metric"
            >
              <div className="flex items-start justify-between">
                <span className="text-sm font-medium text-gray-500">
                  Runners Load Total
                </span>
              </div>
              <div className="mt-3 flex items-end gap-2">
                <span className="text-3xl font-semibold text-gray-900">
                  {metricsOverview?.runnerMetrics?.runnersLoadTotal ?? "-"}
                </span>
              </div>
            </div>
          )}

          <div
            className="group rounded-xl border border-gray-200 bg-white/70 backdrop-blur-sm p-5 shadow-sm transition hover:shadow-md"
            aria-label="Runners total metric"
          >
            <div className="flex items-start justify-between">
              <span className="text-sm font-medium text-gray-500">
                Runners Last Request At
              </span>
            </div>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-2xl font-semibold text-gray-900">
                {metricsOverview?.runnerMetrics?.lastRequestAt ? (
                  <TimeSinceComponent
                    timestamp={
                      (metricsOverview?.runnerMetrics?.lastRequestAt ?? 0) - 2
                    }
                  />
                ) : (
                  "-"
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    </HomePageComponent>
  );
};

export default Component;
