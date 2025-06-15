import { useEffect, useState } from "react";
import { RouteObject, useParams } from "react-router-dom";
import { JobberAction, JobberJob } from "../../../api/jobber.js";
import { JobHeaderComponent } from "../../../components/job-header.js";
import { useActions } from "../../../hooks/actions.js";
import { useConfig } from "../../../hooks/config.js";
import { useJob } from "../../../hooks/job.js";

const RenderActionDetails = ({
  job,
  action,
}: {
  job: JobberJob;
  action: JobberAction;
}) => {
  const [runnerDetails, setRunnerDetails] = useState<
    { name: string; value: string }[]
  >([]);

  const { config } = useConfig();

  useEffect(() => {
    if (!action) {
      setRunnerDetails([]);
      return;
    }

    const details: { name: string; value: string }[] = [];

    details.push({
      name: "Asynchronous",
      value: action.runnerAsynchronous ? "Yes" : "No",
    });

    details.push({
      name: "Min Count",
      value: action.runnerMinCount.toString(),
    });

    details.push({
      name: "Max Count",
      value: action.runnerMaxCount.toString(),
    });

    details.push({
      name: "Max Age",
      value: `${action.runnerMaxAge.toString()} seconds`,
    });

    details.push({
      name: "Max Age (Hard)",
      value: `${action.runnerMaxAgeHard.toString()} seconds`,
    });

    details.push({ name: "Mode", value: action.runnerMode });

    if (config) {
      if (
        config.features.actionDockerArgumentNetworksEnabled &&
        action.runnerDockerArguments.networks
      ) {
        details.push({
          name: "Docker Networks",
          value: action.runnerDockerArguments.networks.join(", "),
        });
      }

      if (
        config.features.actionDockerArgumentVolumesEnabled &&
        action.runnerDockerArguments.volumes
      ) {
        details.push({
          name: "Docker Volumes",
          value: action.runnerDockerArguments.volumes
            .map((v) => `${v.source}:${v.target} (${v.mode})`)
            .join(", "),
        });
      }

      if (
        config.features.actionDockerArgumentLabelsEnabled &&
        action.runnerDockerArguments.labels
      ) {
        details.push({
          name: "Docker Labels",
          value: action.runnerDockerArguments.labels
            .map((l) => `${l.key}=${l.value}`)
            .join(", "),
        });
      }

      if (
        config.features.actionDockerArgumentMemoryLimitEnabled &&
        action.runnerDockerArguments.memoryLimit
      ) {
        details.push({
          name: "Docker Memory Limit",
          value: action.runnerDockerArguments.memoryLimit,
        });
      }

      if (
        config.features.actionDockerArgumentDirectPassthroughEnabled &&
        action.runnerDockerArguments.directPassthroughArguments
      ) {
        details.push({
          name: "Docker Direct Passthrough Arguments",
          value:
            action.runnerDockerArguments.directPassthroughArguments.join(", "),
        });
      }
    }

    setRunnerDetails(details);
  }, [action, config]);

  return (
    <div
      key={action.id}
      className="border rounded shadow-md p-4 bg-white flex flex-col mb-10"
    >
      <h2 className="text-xl font-semibold mb-2">
        {job.jobName}
        {action.version === job.version && (
          <span className="text-gray-400 font-normal">:latest</span>
        )}
      </h2>
      <p className="text-sm text-gray-600">Version: {action.version}</p>
      <p className="text-sm text-gray-600">ID: {action.id}</p>
      <div className="mt-4">
        <p className="text-lg font-semibold mb-2">Runner Details</p>
        <dl className="text-sm">
          {runnerDetails.map((detail, index) => (
            <div
              key={detail.name}
              className={`flex justify-between py-2 ${
                index === runnerDetails.length - 1 ? "" : "border-b"
              }`}
            >
              <dt className="font-medium text-gray-700">{detail.name}:</dt>
              <dd className="text-gray-700">{detail.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
};

const Component = () => {
  const params = useParams();

  const { job } = useJob(params.jobId ?? "");
  const { actions } = useActions(params.jobId ?? "");

  if (!job) {
    return "Please wait, loading..";
  }

  return (
    <div>
      <JobHeaderComponent job={job} />

      <div className="container mx-auto my-8 p-4">
        {actions.length > 0 ? (
          actions.map((action) => (
            <RenderActionDetails key={action.id} job={job} action={action} />
          ))
        ) : (
          <p className="text-gray-600">No actions available.</p>
        )}
      </div>
    </div>
  );
};

export const pagesJobberJobActionsRoute: RouteObject = {
  path: "/jobber/:jobId/actions",
  Component: Component,
};
