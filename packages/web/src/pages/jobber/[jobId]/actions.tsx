import { RouteObject, useParams } from "react-router-dom";
import { JobHeaderComponent } from "../../../components/job-header.js";
import { useJob } from "../../../hooks/job.js";
import { useActions } from "../../../hooks/actions.js";

const Component = () => {
  const params = useParams();

  const { job } = useJob(params.jobId ?? "");
  const { actions } = useActions(params.jobId ?? "");

  if (!job) {
    return "Please wait, loading..";
  }

  return (
    <div>
      <JobHeaderComponent job={job} />

      <div className="container mx-auto my-8 p-4">
        {actions.length > 0 ? (
          actions.map((action) => (
            <div
              key={action.id}
              className="border rounded shadow-md p-4 bg-white flex flex-col mb-10"
            >
              <h2 className="text-xl font-semibold mb-2">
                {job.jobName}
                {action.version === job.version && (
                  <span className="text-gray-400 font-normal">:latest</span>
                )}
              </h2>
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
                    <dt className="font-medium text-gray-700">
                      Max Age (Hard):
                    </dt>
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
            </div>
          ))
        ) : (
          <p className="text-gray-600">No actions available.</p>
        )}
      </div>
    </div>
  );
};

export const pagesJobberJobActionsRoute: RouteObject = {
  path: "/jobber/:jobId/actions",
  Component: Component,
};
