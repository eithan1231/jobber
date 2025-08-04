import { useParams } from "react-router-dom";
import { JobPageComponent } from "../../../../components/job-page-component";
import { useJob } from "../../../../hooks/use-job";
import { useLogs } from "../../../../hooks/use-logs";

export const Component = () => {
  const { jobId } = useParams();

  if (!jobId) {
    return "Job ID is required";
  }

  const { job, jobError } = useJob(jobId);
  const { logs, logsError } = useLogs(jobId);

  if (!job && !jobError) {
    return "loading...";
  }

  if (!job) {
    return "Failed to load job";
  }

  if (jobError) {
    return `Failed to load job: ${jobError}`;
  }

  return (
    <JobPageComponent job={job}>
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
                <td className="px-4 py-2 text-sm text-gray-600 break-words whitespace-pre-wrap">
                  {log.message.replace("\t", "    ")}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </JobPageComponent>
  );
};

export default Component;
