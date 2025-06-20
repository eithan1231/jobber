import { Link, useNavigate } from "react-router-dom";
import { deleteJob, JobberJob, putJob } from "../api/jobber";
import { useConfig } from "../hooks/config";
import { PopupWithConfirm } from "./popup-with-confirm";

export const JobHeaderComponent = ({
  job,
  jobUpdate,
}: {
  job: JobberJob;
  jobUpdate?: () => void;
}) => {
  const navigate = useNavigate();

  const { config } = useConfig();

  const onDisable = () => {
    putJob(job.id, {
      status: "disabled",
    }).then(() => {
      if (jobUpdate) {
        jobUpdate();
      }
    });
  };

  const onEnable = () => {
    putJob(job.id, {
      status: "enabled",
    }).then(() => {
      if (jobUpdate) {
        jobUpdate();
      }
    });
  };

  const onDelete = async () => {
    const result = await deleteJob(job.id);

    if (!result.success) {
      throw new Error("Failed to delete job");
    }

    console.log(result.message);

    navigate("/jobber/");
  };

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
          <Link to={`/jobber/${job.id}/`} className="text-2xl font-semibold">
            {job.jobName}
          </Link>
          <p className="text-sm text-gray-600 mt-1">{job.description}</p>
          {job.version && (
            <p className="text-sm text-gray-500 mt-1">
              Version: <span className="font-medium">{job.version}</span>
            </p>
          )}

          {job.status === "disabled" && (
            <p className="text-sm text-gray-500 mt-1">
              Status: <span className="font-medium text-red-400">Disabled</span>
            </p>
          )}

          {job.status === "enabled" && (
            <p className="text-sm text-gray-500 mt-1">
              Status: <span className="font-medium">Enabled</span>
            </p>
          )}
        </div>
        <div className="mt-auto flex gap-4 pt-4 ">
          <Link
            to={`/jobber/${job.id}/`}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            Overview
          </Link>

          {config?.features.metricsEnabled && (
            <Link
              to={`/jobber/${job.id}/metrics`}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              View Metrics
            </Link>
          )}

          <Link
            to={`/jobber/${job.id}/logs`}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            View Logs
          </Link>

          <Link
            to={`/jobber/${job.id}/environment`}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            View Environment Variables
          </Link>

          <Link
            to={`/jobber/${job.id}/store`}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            View Store
          </Link>

          {job.links.map((link, index) => (
            <Link
              key={index}
              to={link.url
                .replace("{jobId}", job.id)
                .replace("{version}", job.version || "latest")
                .replace("{jobName}", job.jobName)}
              rel="noopener noreferrer"
              target="_blank"
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              {link.name}
            </Link>
          ))}

          {job.status === "disabled" && (
            <button
              onClick={onEnable}
              className={"text-green-600 hover:text-green-800 text-sm ml-auto"}
            >
              Enable
            </button>
          )}

          {job.status === "enabled" && (
            <PopupWithConfirm
              buttonText="Disable"
              buttonClassName="text-red-600 hover:text-red-800 text-sm ml-auto"
              onConfirm={onDisable}
              confirmDescription={`Are you sure you want to disable job?`}
              confirmTitle="Confirm Disable Job"
              confirmButtonText="Disable Job"
            />
          )}

          <PopupWithConfirm
            buttonText="Delete"
            buttonClassName="text-red-600 hover:text-red-800 text-sm"
            onConfirm={onDelete}
            confirmDescription={`Are you sure you wish to delete "${job.jobName}"? This action is irreversible.`}
            confirmTitle="Deletion Confirmation"
            confirmButtonText="Delete"
          />
        </div>
      </div>
    </div>
  );
};
