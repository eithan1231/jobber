import { useEffect, useState } from "react";
import { Link, RouteObject, useLocation } from "react-router-dom";
import { JobberJob, JobberRunner, JobberTrigger } from "../../api/jobber.js";
import { useTriggersLatest } from "../../hooks/triggers-latest.js";
import { useDecoupledStatus } from "../../hooks/decoupled-status.js";
import { useRunners } from "../../hooks/runners.js";
import { useJobs } from "../../hooks/jobs.js";

export const TriggerDetails = ({ trigger }: { trigger: JobberTrigger }) => {
  const { context } = trigger;
  const { message: statusMessage, level: statusLevel } = useDecoupledStatus(
    `trigger-id-${trigger.id}`
  );

  const badgeClasses = {
    schedule: "bg-blue-100 text-blue-800",
    http: "bg-purple-100 text-purple-800",
    mqtt: "bg-green-100 text-green-800",
  } as const;

  return (
    <div className="space-y-2">
      {/* Trigger Type Badge */}
      <div className="flex items-center">
        <span
          className={`
            text-xs font-semibold uppercase px-2 py-1 rounded
            ${badgeClasses[context.type]}
          `}
        >
          {context.type} trigger
        </span>
      </div>

      {/* Status Line */}
      {(statusLevel === "error" || statusLevel === "warn") && (
        <div className="ml-4">
          <strong>Status:</strong>{" "}
          <span className="text-red-600 font-medium">{statusMessage}</span>
        </div>
      )}

      {/* Details */}
      <div className="ml-4 space-y-1 text-gray-700">
        {context.type === "schedule" && (
          <>
            <div>
              <strong>Cron:</strong>{" "}
              <code className="bg-gray-100 px-1 rounded">{context.cron}</code>
            </div>
            {context.timezone && (
              <div>
                <strong>Timezone:</strong> {context.timezone}
              </div>
            )}
          </>
        )}

        {context.type === "http" && (
          <>
            {context.method && (
              <div>
                <strong>Method:</strong> {context.method}
              </div>
            )}

            <div>
              <strong>Path:</strong>{" "}
              <code className="bg-gray-100 px-1 rounded">
                {context.path ?? "/"}
              </code>
            </div>
            {context.hostname && (
              <div>
                <strong>Host:</strong> {context.hostname}
              </div>
            )}
          </>
        )}

        {context.type === "mqtt" && (
          <>
            <div>
              <strong>Topics:</strong>{" "}
              <code className="bg-gray-100 px-1 rounded">
                {context.topics.join(", ") || "—"}
              </code>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <strong>Broker:</strong>{" "}
                {context.connection.host ??
                  context.connection.hostVariable ??
                  "—"}
              </div>
              <div>
                <strong>Port:</strong>{" "}
                {context.connection.port ??
                  context.connection.portVariable ??
                  "—"}
              </div>
            </div>
            {(context.connection.username ||
              context.connection.usernameVariable) && (
              <div>
                <strong>User:</strong>{" "}
                {context.connection.username ||
                  context.connection.usernameVariable}
              </div>
            )}
            {(context.connection.clientId ||
              context.connection.clientIdVariable) && (
              <div>
                <strong>Client ID:</strong>{" "}
                {context.connection.clientId ||
                  context.connection.clientIdVariable}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export const RunnerSummary = ({ runners }: { runners: JobberRunner[] }) => {
  const total = runners.length;
  const active = runners.filter((runner) => runner.status !== "closed").length;
  const processing = runners.reduce(
    (sum, runner) => sum + runner.requestsProcessing,
    0
  );
  const activePct = total > 0 ? Math.round((active / total) * 100) : 0;

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Total */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
        <div className="text-xs uppercase text-gray-500">Total Runners</div>
        <div className="mt-2 text-2xl font-bold">{total}</div>
      </div>

      {/* Active with percent bar */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="text-xs uppercase text-gray-500 mb-1">
          Active Runners
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold">{active}</span>
          <span className="text-sm text-gray-500">{activePct}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 mt-2 overflow-hidden">
          <div
            className="h-2 bg-green-500 rounded-full"
            style={{ width: `${activePct}%` }}
          />
        </div>
      </div>

      {/* Processing */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
        <div className="text-xs uppercase text-gray-500">Processing</div>
        <div className="mt-2 text-2xl font-bold">{processing}</div>
      </div>
    </div>
  );
};

const JobCard = ({ job }: { job: JobberJob }) => {
  const [expanded, setExpanded] = useState(false);
  const { triggers, triggersError } = useTriggersLatest(job.id);
  const { runners, runnersError } = useRunners(job.id);

  const [hasError, _setHasError] = useState(false);

  // TODO: Check trigger decoupled status.

  return (
    <div
      className={`
        border border-gray-300 rounded-2xl shadow p-4 mb-4 bg-white transition-all
        ${hasError ? "ring-2 ring-red-200" : ""}
      `}
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          <div>
            <h2 className="text-xl font-semibold">{job.jobName}</h2>
            <p className="text-sm text-gray-600">{job.description}</p>
          </div>
          {hasError && (
            <span
              className="ml-2 inline-block w-2 h-2 bg-red-500 rounded-full"
              title="Some details failed to load"
            />
          )}
        </div>
        <div className="flex items-center gap-4">
          <span
            className={`text-sm font-medium ${
              job.status === "enabled" ? "text-green-600" : "text-red-600"
            }`}
          >
            {job.status}
          </span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-blue-500 hover:underline"
          >
            {expanded ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-3 text-sm text-gray-700">
          {job.version && (
            <div>
              <strong>Version:</strong> {job.version}
            </div>
          )}

          {job.links?.length > 0 && (
            <div>
              <strong>Links:</strong>
              <ul className="list-disc ml-6">
                {job.links.map((link, idx) => (
                  <li key={idx}>
                    <a
                      href={link.url}
                      className="text-blue-600 hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            {triggersError && (
              <p className="text-red-600 text-sm">
                Triggers Error: {triggersError}
              </p>
            )}
            <div className="space-y-2 mt-2">
              {triggers.map((trigger) => (
                <div
                  key={trigger.id}
                  className="border p-2 rounded-md bg-gray-50"
                >
                  <TriggerDetails key={trigger.id} trigger={trigger} />
                </div>
              ))}
            </div>
          </div>

          <div>
            {runnersError && (
              <p className="text-red-500 text-sm">
                Runners Error: {runnersError}
              </p>
            )}
            {runners && (
              <div className="space-y-2 mt-2">
                <RunnerSummary runners={runners} />
              </div>
            )}
          </div>

          <div>
            <Link
              to={`${job.id}/`}
              className="inline-block mt-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              View Page
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

const Component = () => {
  const { jobs, reloadJobs } = useJobs();
  const [jobsSorted, setJobsSorted] = useState<JobberJob[]>([]);
  const location = useLocation();

  // Sort jobs by status, enabled first
  useEffect(() => {
    if (!jobs) {
      return;
    }
    setJobsSorted(jobs?.sort((a) => (a.status === "enabled" ? -1 : 1)) || []);
  }, [jobs]);

  // Reload jobs when location changes
  useEffect(() => {
    reloadJobs();
  }, [location]);

  return (
    <div className="container mx-auto my-8 p-4">
      <h1 className="text-2xl font-bold mb-6">Jobber Jobs</h1>
      <div className="space-y-4">
        {jobsSorted.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>
    </div>
  );
};

export const pagesJobberLandingRoute: RouteObject = {
  path: "/jobber/",
  Component: Component,
};
