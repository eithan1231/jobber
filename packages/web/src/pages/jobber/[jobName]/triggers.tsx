import {
  getJob,
  getJobEnvironment,
  getJobTrigger,
  JobberEnvironment,
  JobberJob,
  JobberTrigger,
} from "../../../api/jobber.js";
import { useEffect, useState } from "react";
import { RouteObject, useParams } from "react-router-dom";
import { JobHeaderComponent } from "../../../components/job-header.js";

const Component = () => {
  const params = useParams();

  const [job, setJob] = useState<JobberJob>();
  const [triggerVersions, setTriggerVersions] = useState<string[]>([]);
  const [triggers, setTriggers] = useState<JobberTrigger[]>([]);
  const [environment, setEnvironment] = useState<JobberEnvironment>();

  useEffect(() => {
    if (!params.jobName) {
      return;
    }

    getJob(params.jobName).then((result) => {
      if (result.success) {
        setJob(result.data);
      }
    });

    getJobTrigger(params.jobName).then((result) => {
      if (result.success) {
        setTriggers(result.data);

        const versions: string[] = [];
        for (const trigger of result.data) {
          if (!versions.includes(trigger.version)) {
            versions.push(trigger.version);
          }
        }
        setTriggerVersions(versions);
      }
    });

    getJobEnvironment(params.jobName).then((result) => {
      if (result.success) {
        setEnvironment(result.data);
      }
    });
  }, [params.jobName]);

  const EnvironmentParameter = (params: {
    displayName: string;
    variableName?: string;
    variableFallbackValue?: string;
  }) => {
    if (params.variableFallbackValue) {
      return (
        <p className="text-sm text-gray-600">
          {params.displayName}: {params.variableFallbackValue}
        </p>
      );
    }

    if (!environment || !params.variableName) {
      return null;
    }

    if (!environment[params.variableName]) {
      return (
        <p className="text-sm text-gray-600 ">
          {params.displayName}:{" "}
          <span className="text-red-700">Missing "{params.variableName}"</span>
        </p>
      );
    }

    const variable = environment[params.variableName];

    if (variable.type === "secret") {
      return (
        <p className="text-sm text-gray-600">{params.displayName}: *****</p>
      );
    }

    if (variable.type === "text") {
      return (
        <p className="text-sm text-gray-600">
          {params.displayName}: {variable.value}
        </p>
      );
    }
  };

  if (!job) {
    return "Please wait, loading..";
  }

  return (
    <div>
      <JobHeaderComponent job={job} />

      <div className="container mx-auto my-8 p-4">
        {/* Grouped Triggers */}
        {triggerVersions.map((version) => {
          const triggersForVersion = triggers.filter(
            (trigger) => trigger.version === version
          );

          return (
            <div key={version} className="mb-6">
              <h2 className="text-lg font-semibold mb-2 text-gray-800">
                Version: {version}
                {version === job.version && (
                  <span className="text-gray-500 font-normal">:latest</span>
                )}{" "}
              </h2>
              <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {triggersForVersion.map((trigger) => (
                  <div
                    key={trigger.id}
                    className="border rounded shadow-md p-4 bg-white flex flex-col"
                  >
                    <h3 className="text-xl font-semibold mb-2">
                      {trigger.jobName}
                    </h3>
                    <p className="text-sm text-gray-600">ID: {trigger.id}</p>
                    <div className="mt-2">
                      <p className="text-sm font-semibold">Trigger Context:</p>
                      {trigger.context.type === "schedule" && (
                        <div>
                          <p className="text-sm">Type: Schedule</p>
                          <p className="text-sm">
                            Cron: {trigger.context.cron}
                          </p>
                          {trigger.context.timezone && (
                            <p className="text-sm">
                              Timezone: {trigger.context.timezone}
                            </p>
                          )}
                        </div>
                      )}

                      {trigger.context.type === "http" && (
                        <p className="text-sm">Type: HTTP</p>
                      )}

                      {trigger.context.type === "mqtt" && (
                        <div>
                          <p className="text-sm mb-2 ">Type: MQTT</p>
                          <p className="text-sm mb-2">
                            Topics: {trigger.context.topics.join(",")}
                          </p>

                          <EnvironmentParameter
                            displayName="Protocol"
                            variableFallbackValue={
                              trigger.context.connection.protocol
                            }
                            variableName={
                              trigger.context.connection.protocolVariable
                            }
                          />

                          <EnvironmentParameter
                            displayName="Username"
                            variableFallbackValue={
                              trigger.context.connection.username
                            }
                            variableName={
                              trigger.context.connection.usernameVariable
                            }
                          />

                          <EnvironmentParameter
                            displayName="Password"
                            variableFallbackValue={
                              trigger.context.connection.password
                            }
                            variableName={
                              trigger.context.connection.passwordVariable
                            }
                          />

                          <EnvironmentParameter
                            displayName="Host"
                            variableFallbackValue={
                              trigger.context.connection.host
                            }
                            variableName={
                              trigger.context.connection.hostVariable
                            }
                          />

                          <EnvironmentParameter
                            displayName="Port"
                            variableFallbackValue={
                              trigger.context.connection.port
                            }
                            variableName={
                              trigger.context.connection.portVariable
                            }
                          />

                          <EnvironmentParameter
                            displayName="Client ID"
                            variableFallbackValue={
                              trigger.context.connection.clientId
                            }
                            variableName={
                              trigger.context.connection.clientIdVariable
                            }
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const pagesJobberJobTriggersRoute: RouteObject = {
  path: "/jobber/:jobName/triggers",
  Component: Component,
};
