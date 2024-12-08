import { Link } from "react-router-dom";
import { JobberJob } from "../api/jobber";
import { JobDeleteConfirmButton } from "./job-delete-confirm";

export const JobHeaderComponent = ({ job }: { job: JobberJob }) => {
  return (
    <div className="container mx-auto p-4 border-b border-gray-300 mb-3 mt-4">
      {/* Navigation to home */}
      <div className="mb-4">
        <Link
          to="/jobber"
          className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-4 h-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
          Back to Jobs
        </Link>
      </div>

      {/* Job details */}
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
        <div className="mt-auto flex gap-4 pt-4 ">
          <Link
            to={`/jobber/${job.name}/`}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            Overview
          </Link>
          <Link
            to={`/jobber/${job.name}/logs`}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            View Logs
          </Link>
          <Link
            to={`/jobber/${job.name}/environment`}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            View Environment Variables
          </Link>

          <JobDeleteConfirmButton
            className="ml-auto"
            job={job}
            returnTo="/jobber/"
          />
        </div>
      </div>
    </div>
  );
};
