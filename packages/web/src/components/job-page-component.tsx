import { Link, useLocation, useNavigate } from "react-router-dom";
import { deleteJob, JobberJob, updateJob } from "../api/jobs";
import { ConfirmButtonComponent } from "./confirm-button-component";
import { PermissionGuardComponent } from "./permission-guard";

export const JobPageComponent = (props: {
  children: React.ReactElement | React.ReactElement[];
  job: JobberJob;
}) => {
  const navigate = useNavigate();
  const location = useLocation().pathname;

  const handleDisableJob = () => {
    updateJob(props.job.id, {
      status: "disabled",
    });
  };

  const handleEnableJob = () => {
    updateJob(props.job.id, {
      status: "enabled",
    });
  };

  const handleDeleteJob = async () => {
    await deleteJob(props.job.id);
    await navigate("/home/");
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">
          {props.job.jobName}
        </h1>

        {props.job.description && (
          <p className="text-gray-600 mt-1 text-sm">{props.job.description}</p>
        )}

        {props.job.id && (
          <div className="mt-4 flex gap-4 pt-4 text-sm border-t border-gray-200">
            <PermissionGuardComponent
              resource={`job/${props.job.id}`}
              action="read"
            >
              <Link
                to={`/home/job/${props.job.id}/`}
                className={`text-blue-600 hover:text-blue-700 ${
                  location === `/home/job/${props.job.id}/` ? "font-bold" : ""
                }`}
              >
                Overview
              </Link>
            </PermissionGuardComponent>

            <PermissionGuardComponent
              resource={`job/${props.job.id}/versions`}
              action="read"
            >
              <Link
                to={`/home/job/${props.job.id}/versions`}
                className={`text-blue-600 hover:text-blue-700 ${
                  location.startsWith(`/home/job/${props.job.id}/versions`)
                    ? "font-bold"
                    : ""
                }`}
              >
                View Versions
              </Link>
            </PermissionGuardComponent>

            <PermissionGuardComponent
              resource={`job/${props.job.id}/metrics`}
              action="read"
            >
              <Link
                to={`/home/job/${props.job.id}/metrics`}
                className={`text-blue-600 hover:text-blue-700 ${
                  location.startsWith(`/home/job/${props.job.id}/metrics`)
                    ? "font-bold"
                    : ""
                }`}
              >
                View Metrics
              </Link>
            </PermissionGuardComponent>

            <PermissionGuardComponent
              resource={`job/${props.job.id}/logs`}
              action="read"
            >
              <Link
                to={`/home/job/${props.job.id}/logs`}
                className={`text-blue-600 hover:text-blue-700 ${
                  location.startsWith(`/home/job/${props.job.id}/logs`)
                    ? "font-bold"
                    : ""
                }`}
              >
                View Logs
              </Link>
            </PermissionGuardComponent>

            <PermissionGuardComponent
              resource={`job/${props.job.id}/environment`}
              action="read"
            >
              <Link
                to={`/home/job/${props.job.id}/environment`}
                className={`text-blue-600 hover:text-blue-700 ${
                  location.startsWith(`/home/job/${props.job.id}/environment`)
                    ? "font-bold"
                    : ""
                }`}
              >
                View Environment
              </Link>
            </PermissionGuardComponent>

            <PermissionGuardComponent
              resource={`job/${props.job.id}/store`}
              action="read"
            >
              <Link
                to={`/home/job/${props.job.id}/store`}
                className={`text-blue-600 hover:text-blue-700 ${
                  location.startsWith(`/home/job/${props.job.id}/store`)
                    ? "font-bold"
                    : ""
                }`}
              >
                View Store
              </Link>
            </PermissionGuardComponent>

            <PermissionGuardComponent
              resource={`job/${props.job.id}`}
              action="write"
            >
              {props.job.status === "enabled" && (
                <ConfirmButtonComponent
                  buttonClassName="text-red-600 hover:text-red-700 ml-auto font-medium"
                  buttonText="Disable"
                  confirmTitle="Confirm disabling job"
                  onConfirm={() => handleDisableJob()}
                />
              )}
              {props.job.status === "disabled" && (
                <ConfirmButtonComponent
                  buttonClassName="text-green-600 hover:text-green-700 ml-auto font-medium"
                  buttonText="Enable"
                  confirmTitle="Confirm enabling job"
                  onConfirm={() => handleEnableJob()}
                />
              )}
            </PermissionGuardComponent>

            <PermissionGuardComponent
              resource={`job/${props.job.id}`}
              action="delete"
            >
              <ConfirmButtonComponent
                buttonClassName="text-red-600 hover:text-red-700 font-medium"
                buttonText="Delete"
                confirmTitle="Confirm Deletion"
                onConfirm={() => handleDeleteJob()}
              />
            </PermissionGuardComponent>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">{props.children}</div>

      <div className="bg-white border-t border-gray-200 px-6 py-3 text-center">
        <p className="text-sm text-gray-500">
          &copy; 2025 Jobber. All rights reserved.
        </p>
      </div>
    </div>
  );
};
