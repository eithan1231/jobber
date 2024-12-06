import {
  getJob,
  getJobActionLatest,
  getJobEnvironment,
  getJobTriggerLatest,
  JobberAction,
  JobberEnvironment,
  JobberJob,
  JobberTrigger,
} from "../../../api/jobber.js";
import { useEffect, useState } from "react";
import { Link, RouteObject, useParams } from "react-router-dom";
import { JobHeaderComponent } from "../../../components/job-header.js";

const ActionSectionComponent = ({
  action,
  error,
}: {
  action?: JobberAction;
  error?: string;
}) => {
  return (
    <div className="container mx-auto my-8 p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Jobber Action</h1>
        <Link
          className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-1 px-3 rounded-md text-sm shadow-sm"
          to={"./actions"}
        >
          View Previous Versions
        </Link>
      </div>
      <div className="border rounded shadow-md p-4 bg-white flex flex-col">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <strong className="font-bold">Error:</strong>
            <span className="block sm:inline"> {error}</span>
          </div>
        )}

        {action && (
          <>
            <h2 className="text-xl font-semibold mb-2">{action.jobName}</h2>
            <p className="text-sm text-gray-600">Version: {action.version}</p>
            <p className="text-sm text-gray-600">ID: {action.id}</p>
            <div className="mt-4">
              <p className="text-lg font-semibold mb-2">Runner Details</p>
              <dl className="text-sm">
                <div className="flex justify-between border-b py-2">
                  <dt className="font-medium text-gray-700">Asynchronous:</dt>
                  <dd className="text-gray-700">
                    {action.runnerAsynchronous ? "Yes" : "No"}
                  </dd>
                </div>
                <div className="flex justify-between border-b py-2">
                  <dt className="font-medium text-gray-700">Min Count:</dt>
                  <dd className="text-gray-700">{action.runnerMinCount}</dd>
                </div>
                <div className="flex justify-between border-b py-2">
                  <dt className="font-medium text-gray-700">Max Count:</dt>
                  <dd className="text-gray-700">{action.runnerMaxCount}</dd>
                </div>
                <div className="flex justify-between border-b py-2">
                  <dt className="font-medium text-gray-700">Max Age:</dt>
                  <dd className="text-gray-700">
                    {action.runnerMaxAge} seconds
                  </dd>
                </div>
                <div className="flex justify-between border-b py-2">
                  <dt className="font-medium text-gray-700">Max Age (Hard):</dt>
                  <dd className="text-gray-700">
                    {action.runnerMaxAgeHard} seconds
                  </dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="font-medium text-gray-700">Mode:</dt>
                  <dd className="text-gray-700">{action.runnerMode}</dd>
                </div>
              </dl>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const TriggersSectionComponent = ({
  environment,
  triggers,
  error,
}: {
  environment?: JobberEnvironment;
  triggers?: JobberTrigger[];
  error?: string;
}) => {
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

  return (
    <div className="container mx-auto my-8 p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Jobber Triggers</h1>
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
              className="border rounded shadow-md p-4 bg-white flex flex-col"
            >
              <h2 className="text-xl font-semibold mb-2">{trigger.jobName}</h2>
              <p className="text-sm text-gray-600">
                Version: {trigger.version}
              </p>
              <p className="text-sm text-gray-600">ID: {trigger.id}</p>
              <div className="mt-2">
                <p className="text-sm font-semibold">Trigger Context:</p>
                {trigger.context.type === "schedule" && (
                  <div>
                    <p className="text-sm">Type: Schedule</p>
                    <p className="text-sm">Cron: {trigger.context.cron}</p>
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
                  </div>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

const Component = () => {
  const params = useParams();

  const [jobError, setJobError] = useState<string>();
  const [job, setJob] = useState<JobberJob>();

  const [actionError, setActionError] = useState<string>();
  const [action, setAction] = useState<JobberAction>();

  const [triggers, setTriggers] = useState<JobberTrigger[]>();
  const [triggersError, setTriggersError] = useState<string>();

  const [environment, setEnvironment] = useState<JobberEnvironment>();
  const [environmentError, setEnvironmentError] = useState<string>();

  useEffect(() => {
    if (!params.jobName) {
      setJobError("parameter jobName not found");

      return;
    }

    getJob(params.jobName).then((result) => {
      if (!result.success) {
        setJobError(result.message ?? "Failed to get job due to unknown error");

        return;
      }

      setJob(result.data);
    });

    getJobActionLatest(params.jobName).then((result) => {
      if (!result.success) {
        setActionError(
          result.message ?? "Failed to get action due to unknown error"
        );

        return;
      }

      setAction(result.data);
    });

    getJobTriggerLatest(params.jobName).then((result) => {
      if (!result.success) {
        setTriggersError(
          result.message ?? "Failed to get triggers due to unknown error"
        );

        return;
      }

      setTriggers(result.data);
    });

    getJobEnvironment(params.jobName).then((result) => {
      if (!result.success) {
        setEnvironmentError(
          result.message ??
            "Failed to get environment variables due to unknown error"
        );

        return;
      }

      setEnvironment(result.data);
    });
  }, [params.jobName]);

  return (
    <div>
      {jobError}

      {job && (
        <>
          <JobHeaderComponent job={job} />

          <ActionSectionComponent action={action} error={actionError} />
          <TriggersSectionComponent
            triggers={triggers}
            error={triggersError}
            environment={environment}
          />
        </>
      )}
    </div>
  );
};

export const pagesJobberJobRoute: RouteObject = {
  path: "/jobber/:jobName/",
  Component: Component,
};
