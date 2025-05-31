import { deleteJobStoreItem } from "../../../api/jobber.js";
import { RouteObject, useParams } from "react-router-dom";
import { JobHeaderComponent } from "../../../components/job-header.js";
import { useJob } from "../../../hooks/job.js";
import { useStore } from "../../../hooks/store.js";
import { TimeSince } from "../../../components/time-since.js";

const Component = () => {
  const params = useParams();

  if (!params.jobId) {
    return "Job not found";
  }

  const { job } = useJob(params.jobId);
  const { store, storeError, reloadStore } = useStore(params.jobId);

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
                <tr key={item.id}>
                  <td className="border p-2">{item.key ?? <u>N/A</u>}</td>
                  <td className="border p-2">{item.value ?? <u>N/A</u>}</td>

                  <td className="border p-2">
                    <TimeSince timestamp={item.modified} />
                  </td>

                  <td className="border p-2">
                    {item.expiry && <TimeSince timestamp={item.expiry} />}
                    {!item.expiry && <u>N/A</u>}
                  </td>

                  <td className="border p-1">
                    <button
                      className="bg-red-500 text-white px-4 py-2 rounded"
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
