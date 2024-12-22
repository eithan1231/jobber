import {
  getJob,
  getJobLogs,
  JobberJob,
  JobberLogLine,
} from "../../../api/jobber.js";
import { useEffect, useState } from "react";
import { RouteObject, useParams } from "react-router-dom";
import { JobHeaderComponent } from "../../../components/job-header.js";

const Component = () => {
  const params = useParams();

  const [status, setStatus] = useState<"loading" | "loaded" | "error">();
  const [logs, setLogs] = useState<JobberLogLine[]>();
  const [job, setJob] = useState<JobberJob>();

  useEffect(() => {
    if (!params.jobId) {
      return;
    }

    getJob(params.jobId).then((result) => {
      if (result.success) {
        setJob(result.data);
      }
    });

    setStatus("loading");

    getJobLogs(params.jobId).then((result) => {
      if (result.success) {
        setStatus("loaded");

        setLogs(result.data);
      } else {
        setStatus("error");
      }
    });
  }, [params.jobId]);

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
              {status === "loading" && (
                <td className="text-sm text-gray-600">Loading...</td>
              )}

              {status === "error" && (
                <td className="text-sm text-gray-600">Uh oh! Error...</td>
              )}

              {status === "loaded" &&
                logs &&
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
