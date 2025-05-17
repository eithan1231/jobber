import { RouteObject, useParams } from "react-router-dom";
import { JobHeaderComponent } from "../../../components/job-header.js";
import { useJob } from "../../../hooks/job.js";
import { useLogs } from "../../../hooks/logs.js";

const Component = () => {
  const params = useParams();

  if (!params.jobId) {
    return "Job not found";
  }

  const { job } = useJob(params.jobId);
  const { logs, logsError } = useLogs(params.jobId);

  if (!job) {
    return "Please wait, loading..";
  }

  return (
    <div>
      <JobHeaderComponent job={job} />

      <div className="container mx-auto my-8 p-4">
        <div className="bg-white shadow rounded-md">
          <table className="table-auto w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left px-4 py-2 border-b text-sm font-medium text-gray-700">
                  Time
                </th>
                <th className="text-left px-4 py-2 border-b text-sm font-medium text-gray-700">
                  Message
                </th>
              </tr>
            </thead>
            <tbody>
              {logsError && (
                <td className="text-sm text-gray-600">Uh oh! {logsError}.</td>
              )}

              {logs &&
                logs.map((log, index) => (
                  <tr
                    key={index}
                    className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {new Date(log.created * 1000).toLocaleString()}
                    </td>
                    {/* <td className="px-4 py-2 text-sm text-gray-600 whitespace-pre-line">
                    </td> */}
                    <td className="px-4 py-2 text-sm text-gray-600 break-words  ">
                      {log.message}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const pagesJobberJobLogsRoute: RouteObject = {
  path: "/jobber/:jobId/logs",
  Component: Component,
};
