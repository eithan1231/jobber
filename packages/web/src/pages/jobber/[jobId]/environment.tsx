import {
  createJobEnvironmentVariable,
  deleteJobEnvironmentVariable,
  getJobEnvironment,
} from "../../../api/jobber.js";
import { useState } from "react";
import { RouteObject, useParams } from "react-router-dom";
import { JobHeaderComponent } from "../../../components/job-header.js";
import { FormEnvironmentVariableComponent } from "../../../components/form-environment-variable.js";
import { useJob } from "../../../hooks/job.js";
import { useEnvironment } from "../../../hooks/environment.js";

const Component = () => {
  const params = useParams();

  if (!params.jobId) {
    return "Job not found";
  }

  const { job } = useJob(params.jobId);
  const { environment, reloadEnvironment } = useEnvironment(params.jobId);

  const [nameInternal, setNameInternal] = useState<string>("");
  const [valueInternal, setValueInternal] = useState<string>("");
  const [typeInternal, setTypeInternal] = useState<"text" | "secret">("text");

  const deleteVariable = async (name: string) => {
    await deleteJobEnvironmentVariable(params.jobId!, name);

    const result = await getJobEnvironment(params.jobId!);
    if (result.success) {
      reloadEnvironment();
    }
  };

  const upsertVariable = async (
    name: string,
    type: "text" | "secret",
    value: string
  ) => {
    await createJobEnvironmentVariable(params.jobId!, name, value, type);

    const result = await getJobEnvironment(params.jobId!);
    if (result.success) {
      reloadEnvironment();
    }
  };

  if (!job) {
    return "Please wait, loading..";
  }

  return (
    <div>
      <JobHeaderComponent job={job} />

      <div className="container mx-auto my-8 p-4">
        <FormEnvironmentVariableComponent
          name={nameInternal}
          type={typeInternal}
          value={valueInternal}
          onSubmit={(payload) => {
            upsertVariable(payload.name, payload.type, payload.value);
          }}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {environment &&
            Object.entries(environment).map(([name, value]) => {
              return (
                <div key={name} className="bg-white border rounded shadow p-4">
                  <div className="text-gray-700 font-medium">{name}</div>
                  <div className="text-gray-500 text-sm">
                    {value.type === "secret" && "Secret"}
                    {value.type === "text" && "Text"}
                  </div>
                  <div className="mt-2 text-gray-600">
                    {value.type === "secret" && "*****"}
                    {value.type === "text" && value.value}
                  </div>
                  <div className="mt-4 flex space-x-2">
                    <button
                      className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                      onClick={() => {
                        setNameInternal(name);
                        setTypeInternal(value.type);
                        setValueInternal(
                          value.type == "text" ? value.value : ""
                        );
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                      onClick={() => deleteVariable(name)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};

export const pagesJobberJobEnvironmentRoute: RouteObject = {
  path: "/jobber/:jobId/environment",
  Component: Component,
};
