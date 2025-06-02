import {
  deleteJobStoreItem,
  getJobStoreItem,
  JobberStoreItem,
  JobberStoreItemNoValue,
} from "../../../api/jobber.js";
import { RouteObject, useParams } from "react-router-dom";
import { JobHeaderComponent } from "../../../components/job-header.js";
import { useJob } from "../../../hooks/job.js";
import { useStore } from "../../../hooks/store.js";
import { TimeSince } from "../../../components/time-since.js";
import { useEffect, useState } from "react";

const Component = () => {
  const params = useParams();

  if (!params.jobId) {
    return "Job not found";
  }

  const [displayStoreId, setShowValueAlert] = useState<string | null>(null);
  const [displayStoreItem, setShowStoreItem] = useState<
    (JobberStoreItem | JobberStoreItemNoValue) | null
  >(null);

  const { job } = useJob(params.jobId);
  const { store, storeError, reloadStore } = useStore(params.jobId);

  useEffect(() => {
    const storeItemCached = store?.find((item) => item.id === displayStoreId);
    if (storeItemCached) {
      setShowStoreItem(storeItemCached);
    }

    getJobStoreItem(params.jobId!, displayStoreId!).then((storeItem) => {
      if (storeItem.success) {
        setShowStoreItem(storeItem.data);
      }
    });
  }, [displayStoreId]);

  const deleteStoreItem = async (id: string) => {
    console.log(id);
    await deleteJobStoreItem(params.jobId!, id);

    reloadStore();
  };

  if (!job) {
    return "Please wait, loading..";
  }

  return (
    <div>
      <JobHeaderComponent job={job} />

      {displayStoreId && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl mx-4 relative">
            <button
              onClick={() => setShowValueAlert(null)}
              className="absolute top-3 right-3 text-gray-700 hover:text-gray-900 text-xl px-4 py-2 border border-gray-300 rounded-md"
            >
              ×
            </button>
            <h2 className="text-center text-2xl font-semibold text-blue-600 mb-4">
              Store Value
            </h2>
            {displayStoreItem && (
              <>
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-700">Key:</span>
                    <span className="text-gray-900">
                      {displayStoreItem.key}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-700">Modified:</span>
                    <span className="text-gray-900">
                      <TimeSince timestamp={displayStoreItem.modified} />
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-700">Expiry:</span>
                    <span className="text-gray-900">
                      {displayStoreItem.expiry ? (
                        <TimeSince timestamp={displayStoreItem.expiry} />
                      ) : (
                        <u>N/A</u>
                      )}
                    </span>
                  </div>
                </div>
                <div className="mb-6">
                  <pre className="bg-gray-50 border border-gray-300 rounded-md p-4 overflow-auto">
                    {"value" in displayStoreItem
                      ? displayStoreItem.value
                      : "Loading..."}
                  </pre>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="container mx-auto my-8 p-4">
        <table className="min-w-full border-collapse">
          <thead>
            <tr>
              <th className="border p-2">Key</th>
              <th className="border p-2">Value</th>
              <th className="border p-2">Modified</th>
              <th className="border p-2">Expiry</th>
              <th className="border p-1"></th>
            </tr>
          </thead>
          <tbody>
            {storeError && (
              <tr>
                <td colSpan={5} className="border p-2 text-red-500">
                  {storeError}
                </td>
              </tr>
            )}
            {!storeError && store && store.length === 0 && (
              <tr>
                <td colSpan={5} className="border p-2 text-gray-600">
                  No items found in store.
                </td>
              </tr>
            )}
            {store &&
              store?.length > 0 &&
              store.map((item) => (
                <tr
                  key={item.id}
                  className={
                    store.indexOf(item) % 2 === 0 ? "bg-gray-100" : "bg-white"
                  }
                >
                  <td className="border p-2">
                    <span className="truncate block max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap">
                      {item.key ?? <u>N/A</u>}
                    </span>
                  </td>

                  <td className="border p-2">
                    <button
                      className="blur-sm select-none"
                      onClick={() => {
                        setShowValueAlert(item.id);
                      }}
                    >
                      p3n1s{Math.random()}
                    </button>
                  </td>

                  <td className="border p-2">
                    <TimeSince timestamp={item.modified} />
                  </td>

                  <td className="border p-2">
                    {item.expiry && <TimeSince timestamp={item.expiry} />}
                    {!item.expiry && <u>N/A</u>}
                  </td>

                  <td className="border p-1">
                    <button
                      className="bg-red-500 text-white px-2 py-1 rounded text-sm"
                      onClick={() => deleteStoreItem(item.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const pagesJobberJobStoreRoute: RouteObject = {
  path: "/jobber/:jobId/store",
  Component: Component,
};
