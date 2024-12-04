import { Link } from "react-router-dom";
import { JobberJob } from "../api/jobber";

export const JobHeaderComponent = ({ job }: { job: JobberJob }) => {
  return (
    <div className="container mx-auto p-4 border-b border-gray-300 mb-3 mt-10">
      <div className="flex flex-col h-full">
        <div>
          <Link to={`/jobber/${job.name}/`} className="text-2xl font-semibold">
            {job.name}
          </Link>
          <p className="text-sm text-gray-600 mt-1">{job.description}</p>
          {job.version && (
            <p className="text-sm text-gray-500 mt-1">
              Version: <span className="font-medium">{job.version}</span>
            </p>
          )}
        </div>
        <div className="mt-auto flex gap-4 pt-4">
          <Link
            to={`/jobber/${job.name}/logs`}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            View Logs
          </Link>
          <Link
            to={`/jobber/${job.name}/environment`}
            className="text-green-600 hover:text-green-800 text-sm"
          >
            View Environment Variables
          </Link>
        </div>
      </div>
    </div>
  );
};
