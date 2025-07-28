import { useEffect, useMemo, useState } from "react";
import { Link, RouteObject, useParams } from "react-router-dom";
import {
  deleteJobRunner,
  JobberAction,
  JobberEnvironment,
  JobberJob,
  JobberRunner,
  JobberTrigger,
  JobberVersion,
  putJob,
} from "../../../api/jobber.js";
import { PopupWithConfirm } from "../../../components/popup-with-confirm.js";
import { JobHeaderComponent } from "../../../components/job-header.js";
import { useActionCurrent } from "../../../hooks/action-current.js";
import { useConfig } from "../../../hooks/config.js";
import { useEnvironment } from "../../../hooks/environment.js";
import { useJob } from "../../../hooks/job.js";
import { useRunners } from "../../../hooks/runners.js";
import { useTriggersCurrent } from "../../../hooks/triggers-current.js";
import { useVersions } from "../../../hooks/versions.js";
import { formatRelativeTime } from "../../../util.js";
import { useTriggerStatus } from "../../../hooks/trigger-status.js";

// TODO: This file is a mess. Clean it up.

const VersionSectionComponent = ({
  job,
  error,
  versions,
  latestVersion,
  reload,
}: {
  job?: JobberJob;
  error?: string;
  versions: JobberVersion[];
  latestVersion?: JobberVersion;
  reload?: () => void;
}) => {
  const [showAll, setShowAll] = useState(false);

  const foldVersionsSize = 5;
  const foldVersions = versions.length > foldVersionsSize;

  const versionsDisplayable = useMemo(() => {
    const versionSorted = versions.sort((a, b) => b.modified - a.modified);

    if (showAll) {
      return versionSorted;
    }

    return versionSorted.slice(0, foldVersionsSize);
  }, [showAll, versions]);

  const handleDeactivate = () => {
    putJob(job!.id, {
      jobVersionId: null,
    }).then(() => {
      if (reload) {
        reload();
      }
    });
  };

  const handleActivate = (versionId: string) => {
    putJob(job!.id, {
      jobVersionId: versionId,
    }).then(() => {
      if (reload) {
        reload();
      }
    });
  };

  if (!job || !latestVersion) {
    return null;
  }

  return (
    <div className="container mx-auto my-8 p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Versions</h1>
      </div>
      <div className="flex justify-between items-center mb-4">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <strong className="font-bold">Error:</strong>
            <span className="block sm:inline"> {error}</span>
          </div>
        )}

        <table className="table-auto border-collapse border border-gray-300 w-full">
          <thead>
            <tr className="bg-gray-200">
              <th className="border border-gray-300 px-4 py-2 text-left">
                Version
              </th>
              <th className="border border-gray-300 px-4 py-2 text-left">
                Created
              </th>
              <th className="border border-gray-300 px-4 py-2 text-left">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {versionsDisplayable.map((item) => (
              <tr key={item.id} className="odd:bg-white even:bg-gray-100">
                <td className="border border-gray-300 px-4 py-2 text-gray-700">
                  {item.version}

                  {item.id === latestVersion.id && (
                    <span className="mx-2 bg-blue-100 text-blue-800 text-xs font-medium me-2 px-2.5 py-0.5 rounded-full">
                      Latest
                    </span>
                  )}

                  {item.id === job.jobVersionId && (
                    <span className="mx-2 bg-green-100 text-green-800 text-xs font-medium me-2 px-2.5 py-0.5 rounded-full">
                      Active
                    </span>
                  )}
                </td>

                <td
                  className="border border-gray-300 px-4 py-2 text-gray-700"
                  title={`Created: ${new Date(
                    item.created * 1000
                  ).toLocaleString()}`}
                >
                  {formatRelativeTime(item.created)}
                  {item.created !== item.modified && (
                    <span
                      className="text-sm text-gray-500 ml-2"
                      title={`Modified: ${new Date(
                        item.modified * 1000
                      ).toLocaleString()}`}
                    >
                      (Modified: {formatRelativeTime(item.modified)})
                    </span>
                  )}
                </td>

                <th className="border border-gray-300 px-4 py-2 text-left">
                  {item.id === job.jobVersionId ? (
                    <PopupWithConfirm
                      buttonText="Deactivate"
                      buttonClassName="bg-red-500 hover:bg-red-600 text-white font-medium py-1 px-3 rounded-md text-xs shadow-sm"
                      onConfirm={handleDeactivate}
                      confirmDescription={`Are you sure you want to deactivate version ${item.version}? This job will have no active versions and thus not run.`}
                      confirmTitle="Confirm Deactivation"
                      confirmButtonText="Deactivate"
                    />
                  ) : (
                    <PopupWithConfirm
                      buttonText="Activate"
                      buttonClassName={`${
                        item.id !== job.jobVersionId &&
                        item.id === latestVersion.id
                          ? "bg-blue-500 hover:bg-blue-600"
                          : "bg-red-500 hover:bg-red-600"
                      } text-white font-medium py-1 px-3 rounded-md text-xs shadow-sm`}
                      onConfirm={() => handleActivate(item.id)}
                      confirmDescription={`Are you sure you want to activate version ${item.version}? This will make it the active version for the job.`}
                      confirmTitle="Confirm"
                      confirmButtonText="Activate"
                    />
                  )}
                </th>
              </tr>
            ))}
          </tbody>
          {foldVersions && (
            <tfoot>
              <tr className="bg-gray-50">
                <td
                  colSpan={3}
                  className="border border-gray-300 px-4 py-2 justify-center text-center"
                >
                  {!showAll ? (
                    <button
                      className="text-blue-500 hover:underline"
                      onClick={() => setShowAll(true)}
                    >
                      Show All Versions
                    </button>
                  ) : (
                    <button
                      className="text-blue-500 hover:underline"
                      onClick={() => setShowAll(false)}
                    >
                      Show less
                    </button>
                  )}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

const ActionSectionComponent = ({
  action,
  versionLatest,
  error,
}: {
  action?: JobberAction;
  versionLatest?: JobberVersion;
  error?: string;
}) => {
  const [runnerDetails, setRunnerDetails] = useState<
    { name: string; value: string }[]
  >([]);

  const { config } = useConfig();

  useEffect(() => {
    if (!action) {
      setRunnerDetails([]);
      return;
    }

    const details: { name: string; value: string }[] = [];

    details.push({
      name: "Asynchronous",
      value: action.runnerAsynchronous ? "Yes" : "No",
    });

    details.push({
      name: "Min Count",
      value: action.runnerMinCount.toString(),
    });

    details.push({
      name: "Max Count",
      value: action.runnerMaxCount.toString(),
    });

    details.push({
      name: "Timeout",
      value: `${action.runnerTimeout.toString()} seconds`,
    });

    details.push({
      name: "Max Idle Age",
      value: `${action.runnerMaxIdleAge.toString()} seconds`,
    });

    details.push({
      name: "Max Age",
      value: `${action.runnerMaxAge.toString()} seconds`,
    });

    details.push({
      name: "Max Age (Hard)",
      value: `${action.runnerMaxAgeHard.toString()} seconds`,
    });

    details.push({ name: "Mode", value: action.runnerMode });

    if (config) {
      if (
        config.features.actionDockerArgumentNetworksEnabled &&
        action.runnerDockerArguments.networks
      ) {
        details.push({
          name: "Networks",
          value: action.runnerDockerArguments.networks.join(", "),
        });
      }

      if (
        config.features.actionDockerArgumentVolumesEnabled &&
        action.runnerDockerArguments.volumes
      ) {
        details.push({
          name: "Volumes",
          value: action.runnerDockerArguments.volumes
            .map((v) => `${v.source}:${v.target} (${v.mode})`)
            .join(", "),
        });
      }

      if (
        config.features.actionDockerArgumentLabelsEnabled &&
        action.runnerDockerArguments.labels
      ) {
        details.push({
          name: "Labels",
          value: action.runnerDockerArguments.labels
            .map((l) => `${l.key}=${l.value}`)
            .join(", "),
        });
      }

      if (
        config.features.actionDockerArgumentMemoryLimitEnabled &&
        action.runnerDockerArguments.memoryLimit
      ) {
        details.push({
          name: "Memory Limit",
          value: action.runnerDockerArguments.memoryLimit,
        });
      }

      if (
        config.features.actionDockerArgumentDirectPassthroughEnabled &&
        action.runnerDockerArguments.directPassthroughArguments
      ) {
        details.push({
          name: "Direct Passthrough Arguments",
          value:
            action.runnerDockerArguments.directPassthroughArguments.join(", "),
        });
      }
    }

    setRunnerDetails(details);
  }, [action, config]);

  if (!error && !action) {
    return null;
  }

  return (
    <div className="container mx-auto my-8 p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Current Action</h1>
        <Link
          className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-1 px-3 rounded-md text-sm shadow-sm"
          to={"./actions"}
        >
          View Previous Versions
        </Link>
      </div>
      <div className="border rounded shadow-md px-4 pt-4 pb-1 bg-white flex flex-col">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <strong className="font-bold">Error:</strong>
            <span className="block sm:inline"> {error}</span>
          </div>
        )}

        {action && (
          <>
            <h2 className="text-xl font-semibold mb-2">Runner Details</h2>
            {action.jobVersionId !== versionLatest?.id && (
              <p className="text-sm text-gray-600">
                Version: {action.version}
                {versionLatest && action.jobVersionId !== versionLatest.id && (
                  <span className="mx-2 bg-yellow-100 text-yellow-800 text-xs font-medium me-2 px-2.5 py-0.5 rounded-full">
                    Outdated Version
                  </span>
                )}
              </p>
            )}
            <div className="mt-4">
              <dl className="text-sm">
                {runnerDetails.map((detail, index) => (
                  <div
                    key={detail.name}
                    className={`flex justify-between py-2 ${
                      index === runnerDetails.length - 1 ? "" : "border-b"
                    }`}
                  >
                    <dt className="font-medium text-gray-700">
                      {detail.name}:
                    </dt>
                    <dd className="text-gray-700">{detail.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs text-transparent">{action.id}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const TriggersSectionStatusComponent = ({
  trigger,
}: {
  trigger: JobberTrigger;
}) => {
  const { triggerStatus } = useTriggerStatus(trigger.jobId, trigger.id);

  if (triggerStatus === null) {
    return null;
  }

  if (triggerStatus.status === "healthy") {
    return null;
  }

  return (
    <p className="text-sm text-gray-600">
      Status:{" "}
      {triggerStatus.status === "unhealthy" && (
        <span className="text-red-500">{triggerStatus.message}</span>
      )}
      {triggerStatus.status === "unknown" && (
        <span className="text-gray-500">{triggerStatus.message}</span>
      )}
    </p>
  );
};

const TriggersSectionComponent = ({
  environment,
  triggers,
  versionLatest,
  error,
}: {
  environment?: JobberEnvironment;
  triggers?: JobberTrigger[];
  versionLatest?: JobberVersion;
  error?: string;
}) => {
  const EnvironmentParameter = (params: {
    displayName: string;
    variableName?: string;
    variableFallbackValue?: string;
  }) => {
    if (params.variableFallbackValue) {
      return (
        <div className="flex justify-between py-2 border-b">
          <dt className="font-medium text-gray-700">{params.displayName}:</dt>
          <dd className="text-gray-700">{params.variableFallbackValue}</dd>
        </div>
      );
    }

    if (!environment || !params.variableName) {
      return null;
    }

    if (!environment[params.variableName]) {
      return (
        <div className="flex justify-between py-2 border-b">
          <dt className="font-medium text-gray-700">{params.displayName}:</dt>
          <dd className="text-red-700">{params.variableFallbackValue}</dd>
        </div>
      );
    }

    const variable = environment[params.variableName];

    if (variable.type === "secret") {
      return (
        <div className="flex justify-between py-2 border-b">
          <dt className="font-medium text-gray-700">{params.displayName}:</dt>
          <dd className="text-gray-700">******</dd>
        </div>
      );
    }

    if (variable.type === "text") {
      return (
        <div className="flex justify-between py-2 border-b">
          <dt className="font-medium text-gray-700">{params.displayName}:</dt>
          <dd className="text-gray-700">{variable.value}</dd>
        </div>
      );
    }
  };

  if (!error && triggers?.length === 0) {
    return null;
  }

  return (
    <div className="container mx-auto my-8 p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Current Triggers</h1>
        <Link
          className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-1 px-3 rounded-md text-sm shadow-sm"
          to={"./triggers"}
        >
          View Previous Versions
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <strong className="font-bold">Error:</strong>
            <span className="block sm:inline"> {error}</span>
          </div>
        )}
        {triggers &&
          triggers.map((trigger) => (
            <div
              key={trigger.id}
              className="border rounded shadow-md px-4 pt-4 pb-1 bg-white flex flex-col"
            >
              <h2 className="text-L font-semibold mb-2">
                {trigger.context.type === "http" && "HTTP Trigger Context"}
                {trigger.context.type === "mqtt" && "MQTT Trigger Context"}
                {trigger.context.type === "schedule" &&
                  "Schedule Trigger Context"}
              </h2>

              <TriggersSectionStatusComponent trigger={trigger} />

              {trigger.jobVersionId !== versionLatest?.id && (
                <p className="text-sm text-gray-600">
                  Version: {trigger.version}
                  {versionLatest &&
                    trigger.jobVersionId !== versionLatest.id && (
                      <span className="mx-2 bg-yellow-100 text-yellow-800 text-xs font-medium me-2 px-2.5 py-0.5 rounded-full">
                        Outdated Version
                      </span>
                    )}
                </p>
              )}

              <div className="mt-4">
                {trigger.context.type === "schedule" && (
                  <dl className="text-sm">
                    <div className="flex justify-between py-2 border-b">
                      <dt className="font-medium text-gray-700">Type:</dt>
                      <dd className="text-gray-700">Schedule</dd>
                    </div>

                    {trigger.context.name && (
                      <div className="flex justify-between py-2 border-b">
                        <dt className="font-medium text-gray-700">Name:</dt>
                        <dd className="text-gray-700">
                          {trigger.context.name}
                        </dd>
                      </div>
                    )}

                    <div className="flex justify-between py-2 border-b">
                      <dt className="font-medium text-gray-700">Cron:</dt>
                      <dd className="text-gray-700">{trigger.context.cron}</dd>
                    </div>

                    {trigger.context.timezone && (
                      <div className="flex justify-between py-2 border-b">
                        <dt className="font-medium text-gray-700">Timezone:</dt>
                        <dd className="text-gray-700">
                          {trigger.context.timezone}
                        </dd>
                      </div>
                    )}
                  </dl>
                )}

                {trigger.context.type === "http" && (
                  <dl className="text-sm">
                    <div className="flex justify-between py-2 border-b">
                      <dt className="font-medium text-gray-700">Type:</dt>
                      <dd className="text-gray-700">HTTP</dd>
                    </div>

                    {trigger.context.name && (
                      <div className="flex justify-between py-2 border-b">
                        <dt className="font-medium text-gray-700">Name:</dt>
                        <dd className="text-gray-700">
                          {trigger.context.name}
                        </dd>
                      </div>
                    )}

                    {trigger.context.path && (
                      <div className="flex justify-between py-2 border-b">
                        <dt className="font-medium text-gray-700">Path:</dt>
                        <dd className="text-gray-700">
                          {trigger.context.path}
                        </dd>
                      </div>
                    )}

                    {trigger.context.method && (
                      <div className="flex justify-between py-2 border-b">
                        <dt className="font-medium text-gray-700">Method:</dt>
                        <dd className="text-gray-700">
                          {trigger.context.method.toUpperCase()}
                        </dd>
                      </div>
                    )}

                    {trigger.context.hostname && (
                      <div className="flex justify-between py-2 border-b">
                        <dt className="font-medium text-gray-700">Hostname:</dt>
                        <dd className="text-gray-700">
                          {trigger.context.hostname}
                        </dd>
                      </div>
                    )}
                  </dl>
                )}

                {trigger.context.type === "mqtt" && (
                  <dl className="text-sm">
                    <div className="flex justify-between py-2 border-b">
                      <dt className="font-medium text-gray-700">Type:</dt>
                      <dd className="text-gray-700">MQTT</dd>
                    </div>
                    {trigger.context.name && (
                      <div className="flex justify-between py-2 border-b">
                        <dt className="font-medium text-gray-700">Name:</dt>
                        <dd className="text-gray-700">
                          {trigger.context.name}
                        </dd>
                      </div>
                    )}
                    {trigger.context.topics.map((topic) => (
                      <div
                        key={topic}
                        className="flex justify-between py-2 border-b"
                      >
                        <dt className="font-medium text-gray-700">Topic:</dt>
                        <dd className="text-gray-700">{topic}</dd>
                      </div>
                    ))}

                    <EnvironmentParameter
                      displayName="Protocol"
                      variableFallbackValue={
                        trigger.context.connection.protocol
                      }
                      variableName={trigger.context.connection.protocolVariable}
                    />
                    <EnvironmentParameter
                      displayName="Username"
                      variableFallbackValue={
                        trigger.context.connection.username
                      }
                      variableName={trigger.context.connection.usernameVariable}
                    />
                    <EnvironmentParameter
                      displayName="Password"
                      variableFallbackValue={
                        trigger.context.connection.password
                      }
                      variableName={trigger.context.connection.passwordVariable}
                    />
                    <EnvironmentParameter
                      displayName="Host"
                      variableFallbackValue={trigger.context.connection.host}
                      variableName={trigger.context.connection.hostVariable}
                    />
                    <EnvironmentParameter
                      displayName="Port"
                      variableFallbackValue={trigger.context.connection.port}
                      variableName={trigger.context.connection.portVariable}
                    />
                    <EnvironmentParameter
                      displayName="Client ID"
                      variableFallbackValue={
                        trigger.context.connection.clientId
                      }
                      variableName={trigger.context.connection.clientIdVariable}
                    />
                  </dl>
                )}
              </div>
              <p className="text-xs text-transparent mt-2">{trigger.id}</p>
            </div>
          ))}
      </div>
    </div>
  );
};

const RunnersSectionComponent = ({
  job,
  runners,
  error,
}: {
  job: JobberJob;
  runners?: JobberRunner[];
  error?: string;
}) => {
  if (!runners) {
    return null;
  }

  if (job.status === "enabled" && !error && runners.length === 0) {
    // Nothing to render. Job is enabled, but there was no errors and no runners.
    return null;
  }

  return (
    <div className="container mx-auto my-8 p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Jobber Runners</h1>
      </div>
      <div className="flex justify-between items-center mb-4">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <strong className="font-bold">Error:</strong>
            <span className="block sm:inline"> {error}</span>
          </div>
        )}

        <table className="table-auto border-collapse border border-gray-300 w-full">
          <thead>
            <tr className="bg-gray-200">
              <th className="border border-gray-300 px-4 py-2 text-left">
                Status
              </th>
              <th className="border border-gray-300 px-4 py-2 text-left">
                Created
              </th>
              <th className="border border-gray-300 px-4 py-2 text-left">
                Requests in flight
              </th>
              <th className="border border-gray-300 px-4 py-2 text-left">Id</th>
              <th className="border border-gray-300 px-4 py-2 text-left">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {job.status === "disabled" && (
              <tr className="odd:bg-white even:bg-gray-100">
                <td className={"px-4 py-2 text-red-500"}>Job is disabled</td>
              </tr>
            )}
            {runners.map((item) => (
              <tr key={item.id} className="odd:bg-white even:bg-gray-100">
                <td
                  className={
                    "border border-gray-300 px-4 py-2 " +
                    (item.status === "starting" ? "text-blue-800" : "") +
                    (item.status === "ready" ? "text-green-800" : "") +
                    (item.status === "closing" ? "text-orange-800" : "") +
                    (item.status === "closed" ? "text-red-800" : "")
                  }
                >
                  {item.status}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-gray-700">
                  {formatRelativeTime(item.createdAt)}
                  {item.readyAt && (
                    <span className="text-sm text-gray-500 ml-2">
                      (Ready: {formatRelativeTime(item.readyAt)})
                    </span>
                  )}
                  {item.closingAt && (
                    <span className="text-sm text-gray-500 ml-2">
                      (Closing: {formatRelativeTime(item.closingAt)})
                    </span>
                  )}
                  {item.closedAt && (
                    <span className="text-sm text-gray-500 ml-2">
                      (Closed: {formatRelativeTime(item.closedAt)})
                    </span>
                  )}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-gray-700">
                  {item.requestsProcessing}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-gray-700 overflow-hidden text-ellipsis whitespace-nowrap">
                  {item.id.substring(0, 40)}...
                </td>

                <td className="border border-gray-300 px-4 py-2 text-gray-700">
                  <PopupWithConfirm
                    buttonText="Shutdown"
                    buttonClassName="bg-red-500 hover:bg-red-600 text-white font-medium py-1 px-3 rounded-md text-xs shadow-sm"
                    onConfirm={() => deleteJobRunner(job.id, item.id)}
                    confirmDescription={`Are you sure you want to shutdown runner?`}
                    confirmTitle="Confirm Shutdown"
                    confirmButtonText="Shutdown"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Component = () => {
  const params = useParams();

  const jobId = params.jobId;

  if (!jobId) {
    return <div>Job ID is required</div>;
  }

  const [latestVersion, setLatestVersion] = useState<JobberVersion | null>(
    null
  );

  const { job, jobError, reloadJob } = useJob(jobId);

  const { action, actionError, reloadActionCurrent } = useActionCurrent(jobId);

  const { triggers, triggersError, reloadTriggersCurrent } =
    useTriggersCurrent(jobId);

  const { runners, runnersError, reloadRunners } = useRunners(jobId);

  const { versions, versionsError, reloadVersions } = useVersions(jobId);

  const { environment, environmentError, reloadEnvironment } =
    useEnvironment(jobId);

  const updateJob = async () => {
    await Promise.all([
      reloadJob(),
      reloadActionCurrent(),
      reloadTriggersCurrent(),
      reloadRunners(),
      reloadEnvironment(),
      reloadVersions(),
    ]);
  };

  useEffect(() => {
    updateJob();

    const interval = setInterval(() => {
      updateJob();
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [params.jobId]);

  useEffect(() => {
    if (versions && versions.length > 0) {
      const latest = versions.reduce((latest, current) => {
        return current.created > latest.created ? current : latest;
      }, versions[0]);

      setLatestVersion(latest);
    }
  }, [versions]);

  return (
    <div>
      {jobError}

      {job && (
        <>
          <JobHeaderComponent job={job} jobUpdate={updateJob} />
          <VersionSectionComponent
            job={job}
            error={versionsError ?? undefined}
            versions={versions}
            latestVersion={latestVersion ?? undefined}
            reload={updateJob}
          />
          <ActionSectionComponent
            action={action ?? undefined}
            versionLatest={latestVersion ?? undefined}
            error={actionError ?? undefined}
          />
          <TriggersSectionComponent
            triggers={triggers}
            error={triggersError ?? environmentError ?? undefined}
            environment={environment ?? undefined}
            versionLatest={latestVersion ?? undefined}
          />
          <RunnersSectionComponent
            job={job}
            runners={runners}
            error={runnersError ?? undefined}
          />
        </>
      )}
    </div>
  );
};

export const pagesJobberJobRoute: RouteObject = {
  path: "/jobber/:jobId/",
  Component,
};
