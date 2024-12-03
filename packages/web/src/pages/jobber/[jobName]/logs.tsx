import {
  getJob,
  getJobLogs,
  JobberJob,
  JobberLogLine,
} from "../../../api/jobber.js";
import { useEffect, useState } from "react";
import { RouteObject, useParams } from "react-router-dom";

const LogsComponent = () => {
  const params = useParams();

  const [status, setStatus] = useState<"loading" | "loaded" | "error">();
  const [logs, setLogs] = useState<JobberLogLine[]>();
  const [job, setJob] = useState<JobberJob>();

  const [filter, setFilter] = useState("");
  const [selectedColumnsHidden, setSelectedColumnsHidden] = useState(true);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    "timestamp",
    "message",
  ]);

  useEffect(() => {
    if (!params.jobName) {
      return;
    }

    getJob(params.jobName).then((result) => {
      if (result.success) {
        setJob(result.data);
      }
    });

    setStatus("loading");
    getJobLogs(params.jobName, {
      message: filter,
    }).then((result) => {
      if (result.success) {
        setStatus("loaded");

        setLogs(result.data);
      } else {
        setStatus("error");
      }
    });
  }, [params.jobName, filter]);

  if (!job) {
    return "Please wait, loading..";
  }

  const availableColumns = [
    { key: "timestamp", label: "Timestamp" },
    { key: "runnerId", label: "Runner Id" },
    { key: "actionId", label: "Action Id" },
    { key: "jobName", label: "Job Name" },
    { key: "jobVersion", label: "Job Version" },
    { key: "source", label: "Source" },
    { key: "message", label: "Message" },
  ];

  const handleColumnSelection = (key: string) => {
    setSelectedColumns((prev) =>
      prev.includes(key) ? prev.filter((col) => col !== key) : [...prev, key]
    );
  };

  return (
    <div className="container mx-auto my-8 p-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold mb-2">Logs</h1>
        <div className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setFilter((e as any).target.value.toLowerCase());
              }
            }}
            placeholder="Filter by message"
            className="border border-gray-300 rounded-md px-4 py-2 w-full text-sm"
          />
          <div className="relative">
            <button
              className="border border-gray-300 bg-white text-sm px-4 py-2 rounded-md shadow"
              onClick={(e) => {
                e.preventDefault();
                setSelectedColumnsHidden(!selectedColumnsHidden);
              }}
            >
              Select Columns
            </button>
            <div
              hidden={selectedColumnsHidden}
              className="absolute mt-2 w-48 bg-white border rounded-md shadow-lg z-10"
            >
              {availableColumns.map((col) => (
                <label
                  key={col.key}
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <input
                    type="checkbox"
                    checked={selectedColumns.includes(col.key)}
                    onChange={() => handleColumnSelection(col.key)}
                    className="mr-2"
                  />
                  {col.label}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="bg-white shadow rounded-md">
        <table className="table-auto w-full">
          <thead className="bg-gray-100">
            <tr>
              {selectedColumns.map((col) => (
                <th
                  key={col}
                  className="text-left px-4 py-2 border-b text-sm font-medium text-gray-700"
                >
                  {availableColumns.find((ac) => ac.key === col)?.label}
                </th>
              ))}
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
                  {selectedColumns.includes("timestamp") && (
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {new Date(log.timestamp * 1000).toLocaleString()}
                    </td>
                  )}

                  {selectedColumns
                    .filter((col) => col !== "timestamp" && col !== "message")
                    .map((col) => (
                      <td key={col} className="px-4 py-2 text-sm text-gray-600">
                        {log[col as keyof JobberLogLine]}
                      </td>
                    ))}

                  {selectedColumns.includes("message") && (
                    <td className="px-4 py-2 text-sm text-gray-600 break-words  ">
                      {log.message}
                    </td>
                  )}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const pagesJobberJobLogsRoute: RouteObject = {
  path: "/jobber/:jobName/logs",
  Component: LogsComponent,
};
