import {
  getJob,
  getJobActionLatest,
  getJobTriggerLatest,
  JobberAction,
  JobberJob,
  JobberTrigger,
} from "../../../api/jobber.js";
import { useEffect, useState } from "react";
import { Link, RouteObject, useParams } from "react-router-dom";

const JobHeaderComponent = ({ job }: { job: JobberJob }) => {
  return (
    <div className="container mx-auto p-4 border-b border-gray-300 mb-6">
      <div className="flex flex-col h-full">
        <div>
          <h1 className="text-2xl font-semibold">{job.name}</h1>
          <p className="text-sm text-gray-600 mt-1">{job.description}</p>
          {job.version && (
            <p className="text-sm text-gray-500 mt-1">
              Version: <span className="font-medium">{job.version}</span>
            </p>
          )}
        </div>
        <div className="mt-auto flex gap-4 pt-4">
          <Link
            to="./logs"
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            View Logs
          </Link>
          <Link
            to="./environment"
            className="text-green-600 hover:text-green-800 text-sm"
          >
            View Environment Variables
          </Link>
        </div>
      </div>
    </div>
  );
};

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
                  <dd>{action.runnerAsynchronous ? "Yes" : "No"}</dd>
                </div>
                <div className="flex justify-between border-b py-2">
                  <dt className="font-medium text-gray-700">Min Count:</dt>
                  <dd>{action.runnerMinCount}</dd>
                </div>
                <div className="flex justify-between border-b py-2">
                  <dt className="font-medium text-gray-700">Max Count:</dt>
                  <dd>{action.runnerMaxCount}</dd>
                </div>
                <div className="flex justify-between border-b py-2">
                  <dt className="font-medium text-gray-700">Max Age:</dt>
                  <dd>{action.runnerMaxAge} seconds</dd>
                </div>
                <div className="flex justify-between border-b py-2">
                  <dt className="font-medium text-gray-700">Max Age (Hard):</dt>
                  <dd>{action.runnerMaxAgeHard} seconds</dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="font-medium text-gray-700">Mode:</dt>
                  <dd>{action.runnerMode}</dd>
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
  triggers,
  error,
}: {
  triggers?: JobberTrigger[];
  error?: string;
}) => {
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
                {trigger.context.type === "schedule" ? (
                  <div>
                    <p className="text-sm">Type: Schedule</p>
                    <p className="text-sm">Cron: {trigger.context.cron}</p>
                    {trigger.context.timezone && (
                      <p className="text-sm">
                        Timezone: {trigger.context.timezone}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm">Type: HTTP</p>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

const pagesJobberLandingComponent = () => {
  const params = useParams();

  const [jobError, setJobError] = useState<string>();
  const [job, setJob] = useState<JobberJob>();

  const [actionError, setActionError] = useState<string>();
  const [action, setAction] = useState<JobberAction>();

  const [triggers, setTriggers] = useState<JobberTrigger[]>();
  const [triggersError, setTriggersError] = useState<string>();

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
  }, [params.jobName]);

  return (
    <div className="mt-10">
      {jobError}

      {job && (
        <>
          {JobHeaderComponent({ job })}

          {ActionSectionComponent({ action, error: actionError })}
          {TriggersSectionComponent({ triggers, error: triggersError })}
        </>
      )}
    </div>
  );
};

export const pagesJobberJobRoute: RouteObject = {
  path: "/jobber/:jobName/",
  Component: pagesJobberLandingComponent,
};
