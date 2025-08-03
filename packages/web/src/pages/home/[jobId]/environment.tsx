import { useParams } from "react-router-dom";
import { useJob } from "../../../hooks/use-job";
import { JobPageComponent } from "../../../components/job-page-component";
import { useEffect, useState } from "react";
import { useEnvironment } from "../../../hooks/use-environment";
import { ConfirmButtonComponent } from "../../../components/confirm-button-component";
import {
  deleteJobEnvironmentVariable,
  upsertJobEnvironmentVariable,
} from "../../../api/environment";

export const Component = () => {
  const { jobId } = useParams();

  if (!jobId) {
    return "Job ID is required";
  }

  const { job, jobError } = useJob(jobId);
  const { environment, environmentError, reloadEnvironment } =
    useEnvironment(jobId);

  const [nameInternal, setNameInternal] = useState("");
  const [valueInternal, setValueInternal] = useState("");
  const [typeInternal, setTypeInternal] = useState("text");

  if (!job && !jobError) {
    return "loading...";
  }

  if (jobError || environmentError) {
    return `Failed to load job or environment: ${jobError || environmentError}`;
  }

  if (!job || !environment) {
    return "Failed to load job";
  }

  const handleUpsert = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await upsertJobEnvironmentVariable(
      jobId,
      nameInternal,
      valueInternal,
      typeInternal as "text" | "secret"
    );

    reloadEnvironment();

    if (typeInternal === "secret") {
      setValueInternal("");
    }
  };

  const handleDelete = async (name: string) => {
    await deleteJobEnvironmentVariable(jobId, name);
    reloadEnvironment();
  };

  return (
    <JobPageComponent
      jobId={jobId}
      title={job.jobName}
      description={job.description}
    >
      <div>
        <div className="w-full bg-white border rounded shadow p-6 mb-6">
          <form onSubmit={handleUpsert}>
            {/* Name Field */}
            <div className="mb-4">
              <label
                className="block text-sm font-medium text-gray-700 mb-1"
                htmlFor="name"
              >
                Variable Name
              </label>
              <input
                onChange={(e) => setNameInternal(e.target.value)}
                value={nameInternal}
                type="text"
                id="name"
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="e.g., API_KEY"
              />
            </div>

            {/* Type Field */}
            <div className="mb-4">
              <label
                className="block text-sm font-medium text-gray-700 mb-1"
                htmlFor="type"
              >
                Variable Type
              </label>
              <select
                onChange={(e) => {
                  const value = e.target.value;

                  if (value === "text" || value === "secret") {
                    setTypeInternal(value);
                  }
                }}
                value={typeInternal}
                id="type"
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="text">Text</option>
                <option value="secret">Secret</option>
              </select>
            </div>

            {/* Value Field */}
            <div className="mb-4">
              <label
                className="block text-sm font-medium text-gray-700 mb-1"
                htmlFor="value"
              >
                Variable Value
              </label>
              <input
                onChange={(e) => setValueInternal(e.target.value)}
                value={valueInternal}
                type="text"
                id="value"
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="e.g., MyApp"
              />
            </div>

            {/* Submit Button */}
            <div className="mt-6">
              <button
                type="submit"
                className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              >
                Upsert Variable
              </button>
            </div>
          </form>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(environment).map(([name, data]) => {
            const value = data.type === "text" ? data.value : "*******";

            return (
              <div key={name} className="bg-white border rounded shadow p-4">
                <div
                  className="text-gray-700 font-medium overflow-hidden text-ellipsis whitespace-nowrap"
                  title={name}
                >
                  {name}
                </div>
                <div className="text-gray-500 text-sm">
                  {data.type === "text" ? "Text" : "Secret"}
                </div>
                <div
                  className="mt-2 text-gray-600 overflow-hidden text-ellipsis whitespace-nowrap"
                  title={value}
                >
                  {value}
                </div>
                <div className="mt-4 flex space-x-2">
                  <button
                    className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                    onClick={() => {
                      setNameInternal(name);
                      setTypeInternal(data.type);
                      setValueInternal(data.type === "text" ? data.value : "");
                    }}
                  >
                    Edit
                  </button>
                  <ConfirmButtonComponent
                    buttonText="Delete"
                    buttonClassName="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                    confirmTitle="Delete Confirmation"
                    confirmDescription={`"${name}" will be deleted. Are you sure?`}
                    onConfirm={() => {
                      handleDelete(name);
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </JobPageComponent>
  );
};

export default Component;
