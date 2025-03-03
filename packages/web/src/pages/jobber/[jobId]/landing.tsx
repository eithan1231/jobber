import {
  getJob,
  getJobActionLatest,
  getJobEnvironment,
  getJobRunners,
  getJobTriggersLatest,
  JobberAction,
  JobberEnvironment,
  JobberJob,
  JobberRunner,
  JobberTrigger,
} from "../../../api/jobber.js";
import { useEffect, useState } from "react";
import { Link, RouteObject, useParams } from "react-router-dom";
import { JobHeaderComponent } from "../../../components/job-header.js";

const ActionSectionComponent = ({
  job,
  action,
  error,
}: {
  job?: JobberJob;
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
            <h2 className="text-xl font-semibold mb-2">{job?.jobName}</h2>
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
  job,
  environment,
  triggers,
  error,
}: {
  job?: JobberJob;
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
              <h2 className="text-xl font-semibold mb-2">{job?.jobName}</h2>
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
                  <div>
                    <p className="text-sm">Type: HTTP</p>
                    {trigger.context.path && (
                      <p className="text-sm">Path: {trigger.context.path}</p>
                    )}
                    {trigger.context.method && (
                      <p className="text-sm">
                        Method: {trigger.context.method}
                      </p>
                    )}
                    {trigger.context.hostname && (
                      <p className="text-sm">
                        Hostname: {trigger.context.hostname}
                      </p>
                    )}
                  </div>
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
    return <></>;
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
                  {item.requestsProcessing}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-gray-700">
                  {item.id.substring(0, 32)}...
                </td>

                <td className="border border-gray-300 px-4 py-2 text-gray-700">
                  coming soon...
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

  const [jobError, setJobError] = useState<string>();
  const [job, setJob] = useState<JobberJob>();

  const [actionError, setActionError] = useState<string>();
  const [action, setAction] = useState<JobberAction>();

  const [triggers, setTriggers] = useState<JobberTrigger[]>();
  const [triggersError, setTriggersError] = useState<string>();

  const [runners, setRunners] = useState<JobberRunner[]>();
  const [runnersError, setRunnersError] = useState<string>();

  const [environment, setEnvironment] = useState<JobberEnvironment>();
  const [environmentError, setEnvironmentError] = useState<string>();

  const updateJob = async () => {
    if (!params.jobId) {
      setJobError("parameter jobName not found");

      return;
    }

    getJob(params.jobId).then((result) => {
      if (!result.success) {
        setJobError(result.message ?? "Failed to get job due to unknown error");

        return;
      }

      setJob(result.data);
    });

    updateActions();

    updateTriggers();

    updateRunners();

    updateEnvironment();
  };

  const updateActions = () => {
    if (!params.jobId) {
      return;
    }

    getJobActionLatest(params.jobId).then((result) => {
      if (!result.success) {
        setActionError(
          result.message ?? "Failed to get action due to unknown error"
        );

        return;
      }

      setAction(result.data[0]);
    });
  };

  const updateTriggers = () => {
    if (!params.jobId) {
      return;
    }

    getJobTriggersLatest(params.jobId).then((result) => {
      if (!result.success) {
        setTriggersError(
          result.message ?? "Failed to get triggers due to unknown error"
        );

        return;
      }

      setTriggers(result.data);
    });
  };

  const updateRunners = () => {
    if (!params.jobId) {
      return;
    }

    getJobRunners(params.jobId).then((result) => {
      if (!result.success) {
        setRunnersError(
          result.message ?? "Failed to get triggers due to unknown error"
        );

        return;
      }

      setRunners(result.data);
    });
  };

  const updateEnvironment = () => {
    if (!params.jobId) {
      return;
    }

    getJobEnvironment(params.jobId).then((result) => {
      if (!result.success) {
        setEnvironmentError(
          result.message ??
            "Failed to get environment variables due to unknown error"
        );

        return;
      }

      setEnvironment(result.data);
    });
  };

  useEffect(() => {
    updateJob();
  }, [params.jobId]);

  useEffect(() => {
    const interval = setInterval(() => {
      updateRunners();
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <div>
      {jobError}

      {job && (
        <>
          <JobHeaderComponent job={job} jobUpdate={updateJob} />

          <ActionSectionComponent
            job={job}
            action={action}
            error={actionError}
          />
          <TriggersSectionComponent
            job={job}
            triggers={triggers}
            error={triggersError ?? environmentError}
            environment={environment}
          />
          <RunnersSectionComponent
            job={job}
            runners={runners}
            error={runnersError}
          />
        </>
      )}
    </div>
  );
};

export const pagesJobberJobRoute: RouteObject = {
  path: "/jobber/:jobId/",
  Component: Component,
};
