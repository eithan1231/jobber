import { useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { JobberEnvironment } from "../../../../api/environment";
import { updateJob } from "../../../../api/jobs";
import { deleteJobRunner } from "../../../../api/runners";
import { JobberVersion } from "../../../../api/versions";
import { ConfirmButtonComponent } from "../../../../components/confirm-button-component";
import { JobPageComponent } from "../../../../components/job-page-component";
import { TimeSinceComponent } from "../../../../components/time-since-component";
import { useActionCurrent } from "../../../../hooks/use-action-current";
import { useConfig } from "../../../../hooks/use-config";
import { useEnvironment } from "../../../../hooks/use-environment";
import { useJob } from "../../../../hooks/use-job";
import { useRunners } from "../../../../hooks/use-runners";
import { useTriggersCurrent } from "../../../../hooks/use-triggers-current";
import { useVersions } from "../../../../hooks/use-versions";

export const Component = () => {
  const { jobId } = useParams();

  if (!jobId) {
    return "Job ID is required";
  }

  const { config } = useConfig();

  const { job, jobError, reloadJob } = useJob(jobId);
  const { action, reloadActionCurrent } = useActionCurrent(jobId);
  const { triggers, triggersError, reloadTriggersCurrent } =
    useTriggersCurrent(jobId);
  const { versions, versionsError, reloadVersions } = useVersions(jobId);
  const { environment, reloadEnvironment } = useEnvironment(jobId);
  const { runners, runnersError, reloadRunners } = useRunners(jobId);

  useEffect(() => {
    const reloader = () => {
      reloadJob();
      reloadActionCurrent();
      reloadTriggersCurrent();
      reloadVersions();
      reloadEnvironment();
      reloadRunners();
    };

    reloader();

    const interval = setInterval(() => {
      reloader();
    }, 1000);

    return () => clearInterval(interval);
  }, [jobId]);

  const latestVersion = useMemo<JobberVersion | null>(() => {
    if (!versions || versions.length === 0) {
      return null;
    }

    return versions.sort((a, b) => b.created - a.created)[0];
  }, [versions]);

  const latestVersions = useMemo(() => {
    if (!versions) return [];
    return versions.sort((a, b) => b.created - a.created).slice(0, 5);
  }, [versions]);

  const overviewItems = useMemo(() => {
    const items: Array<{ name: string; value: string }> = [];

    if (job && versions) {
      const activeVersion = versions.find(
        (version) => version.id === job.jobVersionId
      );

      if (activeVersion) {
        if (latestVersion && latestVersion.id !== activeVersion.id) {
          items.push({
            name: "Active Version",
            value: `${activeVersion.version} (Latest: ${latestVersion.version})`,
          });
        } else {
          items.push({
            name: "Active Version",
            value: activeVersion.version,
          });
        }
      }
    }

    if (action) {
      items.push({
        name: "Asynchronous",
        value: action.runnerAsynchronous ? "Yes" : "No",
      });

      items.push({
        name: "Minimum Count",
        value: action.runnerMinCount.toString(),
      });

      items.push({
        name: "Maximum Count",
        value: action.runnerMaxCount.toString(),
      });

      items.push({
        name: "Timeout",
        value: `${action.runnerTimeout} seconds`,
      });

      items.push({
        name: "Max Idle age",
        value: `${action.runnerMaxIdleAge} seconds`,
      });

      items.push({
        name: "Max age",
        value: `${action.runnerMaxAge} seconds`,
      });

      items.push({
        name: "Max age (Hard",
        value: `${action.runnerMaxAgeHard} seconds`,
      });

      items.push({
        name: "Max retries",
        value: action.runnerMode === "run-once" ? "Run once" : "Standard",
      });

      if (
        config &&
        config.features.actionDockerArgumentDirectPassthroughEnabled &&
        action.runnerDockerArguments.directPassthroughArguments
      ) {
        for (const argument of action.runnerDockerArguments
          .directPassthroughArguments) {
          items.push({
            name: "Direct Argument",
            value: argument,
          });
        }
      }

      if (
        config &&
        config.features.actionDockerArgumentLabelsEnabled &&
        action.runnerDockerArguments.labels
      ) {
        for (const value of Object.values(
          action.runnerDockerArguments.labels
        )) {
          items.push({
            name: `Docker Label`,
            value: `${value.key} = "${value.value}"`,
          });
        }
      }

      if (
        config &&
        config.features.actionDockerArgumentMemoryLimitEnabled &&
        action.runnerDockerArguments.memoryLimit
      ) {
        items.push({
          name: "Memory Limit",
          value: action.runnerDockerArguments.memoryLimit,
        });
      }

      if (
        config &&
        config.features.actionDockerArgumentNetworksEnabled &&
        action.runnerDockerArguments.networks
      ) {
        for (const network of action.runnerDockerArguments.networks) {
          items.push({
            name: "Network",
            value: network,
          });
        }
      }

      if (
        config &&
        config.features.actionDockerArgumentVolumesEnabled &&
        action.runnerDockerArguments.volumes
      ) {
        for (const volume of action.runnerDockerArguments.volumes) {
          items.push({
            name: "Volume",
            value: `${volume.source}:${volume.target}${
              volume.mode === "ro" ? ":ro" : ""
            }`,
          });
        }
      }
    }

    return items;
  }, [job, action, triggers, versions]);

  if ((!job && !jobError) || (!versions && !versionsError)) {
    return "loading...";
  }

  if (!job) {
    return "Failed to load job";
  }

  if (jobError) {
    return `Failed to load job: ${jobError}`;
  }

  const handleSetActiveVersion = async (versionId: string | null) => {
    const result = await updateJob(job.id, {
      jobVersionId: versionId,
    });

    if (!result.success) {
      console.error("Failed to update job version", result.message);
      return;
    }

    await Promise.all([
      reloadJob(), //
      reloadVersions(),
    ]);
  };

  const handleKillRunner = async (runnerId: string) => {
    await deleteJobRunner(jobId, runnerId, true);
    reloadRunners();
  };

  return (
    <JobPageComponent job={job}>
      <div className="max-w-[800px]">
        {overviewItems.length > 0 && (
          <div className="border rounded shadow-md p-4 pb-5 m-2 bg-white">
            <h2 className="text-xl font-semibold mb-2">Job Details</h2>

            <dl className="text-sm mt-4">
              {overviewItems.map((item, index) => (
                <div
                  key={item.name}
                  className={`flex justify-between py-2 ${
                    index <= overviewItems.length - 1 ? "border-b" : ""
                  }`}
                >
                  <dt className="font-medium text-gray-700">{item.name}</dt>
                  <dd className="text-gray-700">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {latestVersions && latestVersions.length > 0 && (
          <div className="border rounded shadow-md p-4 pb-5 m-2 bg-white">
            <h2 className="text-xl font-semibold mb-2">Versions</h2>

            <table className="min-w-full bg-white">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left">Version</th>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {latestVersions.map((version, index) => (
                  <tr
                    key={`${version.jobId}-${version.id}`}
                    className="border-t"
                  >
                    <td className="px-4 py-2 text-gray-700">
                      {version.version}
                      {index === 0 && (
                        <span className="mx-2 bg-blue-100 text-blue-800 text-xs font-medium me-2 px-2.5 py-0.5 rounded-full">
                          Latest
                        </span>
                      )}
                      {version.id === job.jobVersionId && (
                        <span className="mx-2 bg-green-100 text-green-800 text-xs font-medium me-2 px-2.5 py-0.5 rounded-full">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      <TimeSinceComponent timestamp={version.created} />
                    </td>

                    <td className="px-4 py-2 text-gray-700">
                      {index === 0 && version.id !== job.jobVersionId && (
                        <ConfirmButtonComponent
                          buttonClassName="bg-blue-500 hover:bg-blue-600 text-white font-medium py-1 px-3 rounded-md text-xs shadow-sm"
                          confirmTitle="Confirm Activation"
                          confirmDescription="Are you sure you want to activate this version? This will make it the active version for the job."
                          buttonText="Activate"
                          onConfirm={() => {
                            handleSetActiveVersion(version.id);
                          }}
                        />
                      )}

                      {version.id === job.jobVersionId && (
                        <ConfirmButtonComponent
                          buttonClassName="bg-red-500 hover:bg-red-600 text-white font-medium py-1 px-3 rounded-md text-xs shadow-sm"
                          confirmTitle="Confirm Deactivation"
                          confirmDescription="Are you sure you want to deactivate this version? This will stop all running instances of this version."
                          buttonText="Deactivate"
                          onConfirm={() => {
                            handleSetActiveVersion(null);
                          }}
                        />
                      )}

                      {index !== 0 && version.id !== job.jobVersionId && (
                        <ConfirmButtonComponent
                          buttonClassName="bg-red-500 hover:bg-red-600 text-white font-medium py-1 px-3 rounded-md text-xs shadow-sm"
                          confirmTitle="Confirm Activation"
                          confirmDescription="Are you sure you want to activate this version? It will downgrade the current version."
                          buttonText="Activate"
                          onConfirm={() => {
                            handleSetActiveVersion(version.id);
                          }}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(triggers.length >= 0 || triggersError) && (
          <div className="border rounded shadow-md p-4 pb-5 m-2 bg-white">
            <h2 className="text-xl font-semibold mb-6">Triggers</h2>

            {triggersError && (
              <p className="text-red-500">
                Failed to load triggers: {triggersError}
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
              {/*  */}
              {triggers.map((trigger) => (
                <div
                  key={trigger.id}
                  className="border rounded shadow-sm p-4 bg-gray-50"
                >
                  <h3 className="text-md font-semibold mb-2">
                    {trigger.context.type === "http" && "HTTP Trigger Context"}
                    {trigger.context.type === "mqtt" && "MQTT Trigger Context"}
                    {trigger.context.type === "schedule" &&
                      "Schedule Trigger Context"}
                  </h3>

                  <div className="text-sm text-gray-600 mb-2"></div>

                  <dl className="text-sm mt-4">
                    {trigger.context.type === "schedule" && (
                      <>
                        {trigger.context.name && (
                          <div className="flex justify-between py-1 border-b">
                            <dt className="font-medium text-gray-700">Name</dt>
                            <dd className="text-gray-700">
                              {trigger.context.name}
                            </dd>
                          </div>
                        )}

                        <div className="flex justify-between py-1 border-b">
                          <dt className="font-medium text-gray-700">Cron</dt>
                          <dd className="text-gray-700">
                            {trigger.context.cron}
                          </dd>
                        </div>

                        {trigger.context.timezone && (
                          <div className="flex justify-between py-1 border-b">
                            <dt className="font-medium text-gray-700">
                              Timezone
                            </dt>
                            <dd className="text-gray-700">
                              {trigger.context.timezone}
                            </dd>
                          </div>
                        )}
                      </>
                    )}

                    {trigger.context.type === "http" && (
                      <>
                        {trigger.context.name && (
                          <div className="flex justify-between py-1 border-b">
                            <dt className="font-medium text-gray-700">Name</dt>
                            <dd className="text-gray-700">
                              {trigger.context.name}
                            </dd>
                          </div>
                        )}

                        {trigger.context.hostname && (
                          <div className="flex justify-between py-1 border-b">
                            <dt className="font-medium text-gray-700">Host</dt>
                            <dd className="text-gray-700">
                              {trigger.context.hostname}
                            </dd>
                          </div>
                        )}

                        {trigger.context.path && (
                          <div className="flex justify-between py-1 border-b">
                            <dt className="font-medium text-gray-700">Path</dt>
                            <dd className="text-gray-700">
                              {trigger.context.path}
                            </dd>
                          </div>
                        )}

                        {trigger.context.method && (
                          <div className="flex justify-between py-1 border-b">
                            <dt className="font-medium text-gray-700">
                              Method
                            </dt>
                            <dd className="text-gray-700">
                              {trigger.context.method}
                            </dd>
                          </div>
                        )}
                      </>
                    )}

                    {trigger.context.type === "mqtt" && (
                      <>
                        {trigger.context.name && (
                          <div className="flex justify-between py-1 border-b">
                            <dt className="font-medium text-gray-700">Name</dt>
                            <dd className="text-gray-700">
                              {trigger.context.name}
                            </dd>
                          </div>
                        )}

                        {trigger.context.topics.map((topic, index) => (
                          <div className="flex justify-between py-1 border-b">
                            <dt className="font-medium text-gray-700">
                              Topic #{index + 1}
                            </dt>
                            <dd className="text-gray-700">{topic}</dd>
                          </div>
                        ))}

                        {environment && (
                          <>
                            <TriggerConnectionPartComponent
                              environment={environment}
                              displayName="Protocol"
                              variableFallbackValue={
                                trigger.context.connection.protocol
                              }
                              variableName={
                                trigger.context.connection.protocolVariable
                              }
                            />
                            <TriggerConnectionPartComponent
                              environment={environment}
                              displayName="Username"
                              variableFallbackValue={
                                trigger.context.connection.username
                              }
                              variableName={
                                trigger.context.connection.usernameVariable
                              }
                            />
                            <TriggerConnectionPartComponent
                              environment={environment}
                              displayName="Password"
                              variableFallbackValue={
                                trigger.context.connection.password
                              }
                              variableName={
                                trigger.context.connection.passwordVariable
                              }
                            />
                            <TriggerConnectionPartComponent
                              environment={environment}
                              displayName="Host"
                              variableFallbackValue={
                                trigger.context.connection.host
                              }
                              variableName={
                                trigger.context.connection.hostVariable
                              }
                            />
                            <TriggerConnectionPartComponent
                              environment={environment}
                              displayName="Port"
                              variableFallbackValue={
                                trigger.context.connection.port
                              }
                              variableName={
                                trigger.context.connection.portVariable
                              }
                            />
                            <TriggerConnectionPartComponent
                              environment={environment}
                              displayName="Client ID"
                              variableFallbackValue={
                                trigger.context.connection.clientId
                              }
                              variableName={
                                trigger.context.connection.clientIdVariable
                              }
                            />
                          </>
                        )}
                      </>
                    )}
                  </dl>
                </div>
              ))}
            </div>
          </div>
        )}

        {(runners.length >= 0 || runnersError) && (
          <div className="max-w-full border rounded shadow-md p-4 pb-5 m-2 bg-white">
            <h2 className="text-xl font-semibold mb-6">Runners</h2>

            {runnersError && (
              <p className="text-red-500">
                Failed to load runners: {runnersError}
              </p>
            )}

            <table className="w-full bg-white">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Created</th>
                  <th className="px-4 py-2 text-left">Requests</th>
                  <th className="px-4 py-2 text-left">Id</th>
                  <th className="px-4 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {runners.map((runner) => {
                  let createdSubText: React.ReactElement | null = null;

                  if (runner.closedAt) {
                    createdSubText = (
                      <>
                        Closed:{" "}
                        <TimeSinceComponent timestamp={runner.closedAt} />
                      </>
                    );
                  } else if (runner.closingAt) {
                    createdSubText = (
                      <>
                        Closing:{" "}
                        <TimeSinceComponent timestamp={runner.closingAt} />
                      </>
                    );
                  } else if (runner.readyAt) {
                    createdSubText = (
                      <>
                        Ready: <TimeSinceComponent timestamp={runner.readyAt} />
                      </>
                    );
                  }

                  return (
                    <tr key={runner.id} className="border-t text-sm">
                      <td
                        className={`px-4 py-2 text-gray-700
                          ${runner.status === "starting" ? "text-blue-600" : ""}
                          ${runner.status === "ready" ? "text-green-600" : ""}
                          ${runner.status === "closing" ? "text-red-600" : ""}
                          ${runner.status === "closed" ? "text-red-600" : ""}
                        `}
                      >
                        {runner.status}
                      </td>
                      <td className="px-4 py-2 text-gray-700">
                        <TimeSinceComponent timestamp={runner.createdAt} />

                        {createdSubText && (
                          <span className="text-xs text-gray-500">
                            {" "}
                            ({createdSubText})
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-2 text-gray-700">
                        {runner.requestsProcessing}
                      </td>

                      <td className="px-4 py-2 text-gray-700 overflow-hidden text-ellipsis whitespace-nowrap max-w-[200px]">
                        {runner.id}
                      </td>

                      <td className="px-4 py-2 text-gray-700">
                        <ConfirmButtonComponent
                          buttonClassName="bg-red-500 hover:bg-red-600 text-white font-medium py-1 px-3 rounded-md text-xs shadow-sm"
                          confirmTitle="Confirm runner shutdown"
                          confirmDescription="Are you sure you want to shutdown this runner? Its execution will stop."
                          buttonText="Kill"
                          onConfirm={() => {
                            handleKillRunner(runner.id);
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </JobPageComponent>
  );
};

const TriggerConnectionPartComponent = (params: {
  environment: JobberEnvironment;
  displayName: string;
  variableName?: string;
  variableFallbackValue?: string;
}) => {
  if (params.variableFallbackValue) {
    return (
      <div className="flex justify-between py-1 border-b">
        <dt className="font-medium text-gray-700">{params.displayName}:</dt>
        <dd className="text-gray-700">{params.variableFallbackValue}</dd>
      </div>
    );
  }

  if (!params.environment || !params.variableName) {
    return null;
  }

  if (!params.environment[params.variableName]) {
    return (
      <div className="flex justify-between py-1 border-b">
        <dt className="font-medium text-gray-700">{params.displayName}:</dt>
        <dd className="text-red-700">{params.variableFallbackValue}</dd>
      </div>
    );
  }

  const variable = params.environment[params.variableName];

  if (variable.type === "secret") {
    return (
      <div className="flex justify-between py-1 border-b">
        <dt className="font-medium text-gray-700">{params.displayName}:</dt>
        <dd className="text-gray-700">******</dd>
      </div>
    );
  }

  if (variable.type === "text") {
    return (
      <div className="flex justify-between py-1 border-b">
        <dt className="font-medium text-gray-700">{params.displayName}:</dt>
        <dd className="text-gray-700">{variable.value}</dd>
      </div>
    );
  }
};

export default Component;
