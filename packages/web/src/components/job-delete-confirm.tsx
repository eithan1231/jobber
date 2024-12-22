import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { deleteJob, JobberJob } from "../api/jobber.js";

export const JobDeleteConfirmButton = (props: {
  className?: string;
  job: JobberJob;
  returnTo: string;
}) => {
  const navigate = useNavigate();

  const [visible, setVisible] = useState(false);
  const [disabled, setDisabled] = useState(false);

  const onShow = () => {
    setVisible(true);
  };

  const onHide = () => {
    setVisible(false);
  };

  const onDelete = async () => {
    setDisabled(true);

    const result = await deleteJob(props.job.id);

    if (!result.success) {
      throw new Error("Failed to delete job");
    }

    console.log(result.message);

    setVisible(false);
    setDisabled(false);

    navigate(props.returnTo);
  };

  return (
    <>
      <button
        onClick={onShow}
        className={"text-red-600 hover:text-red-800 text-sm " + props.className}
      >
        Delete
      </button>

      {visible && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-96">
            <h2 className="text-xl font-bold text-red-600 text-center mb-4">
              Confirm Deletion
            </h2>
            <div className="mb-4">
              <p className="text-gray-800">
                Are you sure you want to delete the following job?
              </p>
              <div className="mt-4 border border-gray-300 rounded-lg p-4 bg-gray-50">
                <p className="font-semibold">{props.job.jobName}</p>
                <p className="text-sm text-gray-600">{props.job.description}</p>
                {props.job.version && (
                  <p className="text-sm text-gray-500">
                    Version:{" "}
                    <span className="font-medium">{props.job.version}</span>
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-between mt-6">
              <button
                disabled={disabled}
                onClick={onHide}
                className={
                  "font-semibold py-2 px-4 rounded " +
                  (disabled
                    ? "bg-gray-200 text-gray-800"
                    : "bg-gray-200 hover:bg-gray-300 text-gray-800")
                }
              >
                Cancel
              </button>
              <Link
                to={props.returnTo}
                onClick={onDelete}
                className={
                  "font-semibold py-2 px-4 rounded " +
                  (disabled
                    ? "bg-gray-200 text-gray-800"
                    : "text-white bg-red-600 hover:bg-red-700")
                }
              >
                Delete
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
