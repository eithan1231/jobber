import { useContext, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { updateJob } from "../../../../api/jobs";
import { deleteJobRunner } from "../../../../api/runners";
import { JobberVersion } from "../../../../api/versions";
import { ConfirmButtonComponent } from "../../../../components/confirm-button-component";
import { JobPageComponent } from "../../../../components/job-page-component";
import { TimeSinceComponent } from "../../../../components/time-since-component";
import { useActionCurrent } from "../../../../hooks/use-action-current";
import { useEnvironment } from "../../../../hooks/use-environment";
import { useJob } from "../../../../hooks/use-job";
import { useRunners } from "../../../../hooks/use-runners";
import { useTriggersCurrent } from "../../../../hooks/use-triggers-current";
import { useVersions } from "../../../../hooks/use-versions";
import { PermissionGuardComponent } from "../../../../components/permission-guard";
import { AuthContext } from "../../../../contexts/auth-context";

export const Component = () => {
  const jobId = useParams().jobId ?? "";

  const { config } = useContext(AuthContext);

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
        name: "Max age (Hard)",
        value: `${action.runnerMaxAgeHard} seconds`,
      });

      items.push({
        name: "Mode",
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
    <PermissionGuardComponent resource={`job/${jobId}`} action="read">
      <JobPageComponent job={job}>
        <div className="container mx-auto px-4 py-6 max-w-6xl">
          {/* Job Details Card */}
          {overviewItems.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-6">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-semibold text-gray-900">
                  Configuration
                </h2>
              </div>
              <div className="p-6">
                <dl className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                  {overviewItems.map((item) => (
                    <div key={item.name}>
                      <dt className="text-sm font-medium text-gray-500 mb-1">
                        {item.name}
                      </dt>
                      <dd className="text-sm text-gray-900 font-mono">
                        {item.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          )}

          {/* Versions Card */}
          {latestVersions && latestVersions.length > 0 && (
            <PermissionGuardComponent
              resource={`job/${jobId}/versions`}
              action="read"
            >
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-6">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Recent Versions
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Version
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Created
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {latestVersions.map((version, index) => (
                        <tr
                          key={`${version.jobId}-${version.id}`}
                          className="hover:bg-gray-50"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900">
                                {version.version}
                              </span>
                              {index === 0 && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  Latest
                                </span>
                              )}
                              {version.id === job.jobVersionId && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  Active
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            <TimeSinceComponent timestamp={version.created} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                            <PermissionGuardComponent
                              resource={`job/${jobId}/versions/${version.id}`}
                              action="write"
                            >
                              {index === 0 &&
                                version.id !== job.jobVersionId && (
                                  <ConfirmButtonComponent
                                    buttonClassName="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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
                                  buttonClassName="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                  confirmTitle="Confirm Deactivation"
                                  confirmDescription="Are you sure you want to deactivate this version? This will stop all running instances of this version."
                                  buttonText="Deactivate"
                                  onConfirm={() => {
                                    handleSetActiveVersion(null);
                                  }}
                                />
                              )}

                              {index !== 0 &&
                                version.id !== job.jobVersionId && (
                                  <ConfirmButtonComponent
                                    buttonClassName="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                                    confirmTitle="Confirm Activation"
                                    confirmDescription="Are you sure you want to activate this version? It will downgrade the current version."
                                    buttonText="Activate"
                                    onConfirm={() => {
                                      handleSetActiveVersion(version.id);
                                    }}
                                  />
                                )}
                            </PermissionGuardComponent>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </PermissionGuardComponent>
          )}

          {/* Triggers Card */}
          {(triggers.length >= 0 || triggersError) && (
            <PermissionGuardComponent
              resource={`job/${jobId}/triggers`}
              action="read"
            >
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-6">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Triggers
                  </h2>
                </div>

                {triggersError && (
                  <div className="p-6">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-red-600 text-sm font-medium">
                        Failed to load triggers: {triggersError}
                      </p>
                    </div>
                  </div>
                )}

                {!triggersError && triggers.length === 0 && (
                  <div className="p-6 text-center">
                    <p className="text-gray-500 text-sm">
                      No triggers configured
                    </p>
                  </div>
                )}

                {!triggersError && triggers.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Type
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Configuration
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {triggers.map((trigger) => (
                          <tr key={trigger.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900">
                                  {trigger.context.type === "http" && "HTTP"}
                                  {trigger.context.type === "mqtt" && "MQTT"}
                                  {trigger.context.type === "schedule" &&
                                    "Schedule"}
                                </span>
                              </div>
                              {trigger.context.name && (
                                <div className="text-xs text-gray-500 mt-0.5">
                                  {trigger.context.name}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                  trigger.status.status === "unhealthy"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-green-100 text-green-800"
                                }`}
                              >
                                {trigger.status.status === "unhealthy"
                                  ? "Unhealthy"
                                  : "Healthy"}
                              </span>
                              {trigger.status.message && (
                                <div className="text-xs text-gray-500 mt-1 max-w-xs">
                                  {trigger.status.message}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {/* Schedule Trigger */}
                              {trigger.context.type === "schedule" && (
                                <div className="space-y-1 text-sm text-gray-900">
                                  <div>
                                    <span className="font-mono">
                                      {trigger.context.cron}
                                    </span>
                                  </div>
                                  {trigger.context.timezone && (
                                    <div className="text-xs text-gray-600">
                                      {trigger.context.timezone}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* HTTP Trigger */}
                              {trigger.context.type === "http" && (
                                <div className="space-y-1 text-sm">
                                  <div className="flex items-center gap-2">
                                    {trigger.context.method && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                        {trigger.context.method}
                                      </span>
                                    )}
                                    <div className="font-mono text-gray-900">
                                      {trigger.context.hostname || ""}
                                      {trigger.context.path || ""}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* MQTT Trigger */}
                              {trigger.context.type === "mqtt" && (
                                <div className="space-y-2 text-sm">
                                  {environment && (
                                    <div>
                                      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                                        Connection
                                      </div>
                                      <div className="space-y-0.5 text-xs">
                                        {trigger.context.connection
                                          .protocol && (
                                          <div className="text-gray-900">
                                            <span className="font-mono">
                                              {
                                                trigger.context.connection
                                                  .protocol
                                              }
                                              ://
                                            </span>
                                            <span className="font-mono">
                                              {trigger.context.connection.host}
                                            </span>
                                            {trigger.context.connection
                                              .port && (
                                              <span className="font-mono">
                                                :
                                                {
                                                  trigger.context.connection
                                                    .port
                                                }
                                              </span>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  <div>
                                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                                      Topics
                                    </div>
                                    <div className="space-y-0.5">
                                      {trigger.context.topics.map((topic) => (
                                        <div
                                          key={topic}
                                          className="font-mono text-gray-900 text-xs"
                                        >
                                          {topic}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </PermissionGuardComponent>
          )}

          {/* Runners Card */}
          {(runners.length >= 0 || runnersError) && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-6">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-semibold text-gray-900">
                  Active Runners
                </h2>
              </div>

              {runnersError && (
                <div className="p-6">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-600 text-sm font-medium">
                      Failed to load runners: {runnersError}
                    </p>
                  </div>
                </div>
              )}

              {!runnersError && runners.length === 0 && (
                <div className="p-6 text-center">
                  <p className="text-gray-500 text-sm">No active runners</p>
                </div>
              )}

              {!runnersError && runners.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Created
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Requests
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Runner ID
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
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
                              <TimeSinceComponent
                                timestamp={runner.closingAt}
                              />
                            </>
                          );
                        } else if (runner.readyAt) {
                          createdSubText = (
                            <>
                              Ready:{" "}
                              <TimeSinceComponent timestamp={runner.readyAt} />
                            </>
                          );
                        }

                        return (
                          <tr key={runner.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  runner.status === "starting"
                                    ? "bg-blue-100 text-blue-800"
                                    : runner.status === "ready"
                                    ? "bg-green-100 text-green-800"
                                    : runner.status === "closing" ||
                                      runner.status === "closed"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {runner.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              <TimeSinceComponent
                                timestamp={runner.createdAt}
                              />
                              {createdSubText && (
                                <div className="text-xs text-gray-500 mt-0.5">
                                  {createdSubText}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {runner.requestsProcessing}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600 font-mono max-w-xs truncate">
                              {runner.id}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                              <PermissionGuardComponent
                                resource={`job/${jobId}/runners/${runner.id}`}
                                action="delete"
                              >
                                <ConfirmButtonComponent
                                  buttonClassName="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                  confirmTitle="Confirm runner shutdown"
                                  confirmDescription="Are you sure you want to shutdown this runner? Its execution will stop."
                                  buttonText="Kill"
                                  onConfirm={() => {
                                    handleKillRunner(runner.id);
                                  }}
                                />
                              </PermissionGuardComponent>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </JobPageComponent>
    </PermissionGuardComponent>
  );
};

export default Component;
