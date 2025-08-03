import { Link, useLocation } from "react-router-dom";

export const JobPageComponent = (props: {
  children: React.ReactElement | React.ReactElement[];
  title: string;
  description?: string;
  jobId?: string;
}) => {
  const location = useLocation().pathname;
  return (
    <div className="flex flex-col h-screen">
      <div className="bg-gray-800 text-white p-4 pb-2">
        <h1 className="text-2xl font-bold text-gray-200">{props.title}</h1>

        {props.description && (
          <p className="text-gray-400 mt-1 text-sm">{props.description}</p>
        )}

        {props.jobId && (
          <div className="mt-4 flex space-x-4 text-sm rounded-lg">
            <Link
              to={`/home/job/${props.jobId}/`}
              className={`text-blue-300 hover:underline ${
                location === `/home/job/${props.jobId}/` ? "font-bold" : ""
              }`}
            >
              Overview
            </Link>
            <Link
              to={`/home/job/${props.jobId}/versions`}
              className={`text-blue-300 hover:underline ${
                location.startsWith(`/home/job/${props.jobId}/versions`)
                  ? "font-bold"
                  : ""
              }`}
            >
              View Versions
            </Link>
            <Link
              to={`/home/job/${props.jobId}/metrics`}
              className={`text-blue-300 hover:underline ${
                location.startsWith(`/home/job/${props.jobId}/metrics`)
                  ? "font-bold"
                  : ""
              }`}
            >
              View Metrics
            </Link>
            <Link
              to={`/home/job/${props.jobId}/logs`}
              className={`text-blue-300 hover:underline ${
                location.startsWith(`/home/job/${props.jobId}/logs`)
                  ? "font-bold"
                  : ""
              }`}
            >
              View Logs
            </Link>
            <Link
              to={`/home/job/${props.jobId}/environment`}
              className={`text-blue-300 hover:underline ${
                location.startsWith(`/home/job/${props.jobId}/environment`)
                  ? "font-bold"
                  : ""
              }`}
            >
              View Environment
            </Link>
            <Link
              to={`/home/job/${props.jobId}/store`}
              className={`text-blue-300 hover:underline ${
                location.startsWith(`/home/job/${props.jobId}/store`)
                  ? "font-bold"
                  : ""
              }`}
            >
              View Store
            </Link>
          </div>
        )}
      </div>

      <div className="flex-1 p-4 overflow-y-scroll">{props.children}</div>

      <div className="bg-gray-800 text-white p-4 text-center">
        <p>&copy; 2025 Jobber. All rights reserved.</p>
      </div>
    </div>
  );
};
