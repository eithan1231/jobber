import {
  getJob,
  getJobTrigger,
  JobberJob,
  JobberTrigger,
} from "../../../api/jobber.js";
import { useEffect, useState } from "react";
import { Link, RouteObject, useParams } from "react-router-dom";
import { JobHeaderComponent } from "../../../components/job-header.js";

const Component = () => {
  const params = useParams();

  const [job, setJob] = useState<JobberJob>();
  const [triggerVersions, setTriggerVersions] = useState<string[]>([]);
  const [triggers, setTriggers] = useState<JobberTrigger[]>([]);

  useEffect(() => {
    if (!params.jobName) {
      return;
    }

    getJob(params.jobName).then((result) => {
      if (result.success) {
        setJob(result.data);
      }
    });

    getJobTrigger(params.jobName).then((result) => {
      if (result.success) {
        setTriggers(result.data);

        const versions: string[] = [];
        for (const trigger of result.data) {
          if (!versions.includes(trigger.version)) {
            versions.push(trigger.version);
          }
        }
        setTriggerVersions(versions);
      }
    });
  }, [params.jobName]);

  if (!job) {
    return "Please wait, loading..";
  }

  return (
    <div>
      <JobHeaderComponent job={job} />

      <div className="container mx-auto my-8 p-4">
        {/* Grouped Triggers */}
        {triggerVersions.map((version) => {
          const triggersForVersion = triggers.filter(
            (trigger) => trigger.version === version
          );

          return (
            <div key={version} className="mb-6">
              <h2 className="text-lg font-semibold mb-2 text-gray-800">
                Version: {version}
                {version === job.version && (
                  <span className="text-gray-500 font-normal">:latest</span>
                )}{" "}
              </h2>
              <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {triggersForVersion.map((trigger) => (
                  <div
                    key={trigger.id}
                    className="border rounded shadow-md p-4 bg-white flex flex-col"
                  >
                    <h3 className="text-xl font-semibold mb-2">
                      {trigger.jobName}
                    </h3>
                    <p className="text-sm text-gray-600">ID: {trigger.id}</p>
                    <div className="mt-2">
                      <p className="text-sm font-semibold">Trigger Context:</p>
                      {trigger.context.type === "schedule" ? (
                        <div>
                          <p className="text-sm">Type: Schedule</p>
                          <p className="text-sm">
                            Cron: {trigger.context.cron}
                          </p>
                          {trigger.context.timezone && (
                            <p className="text-sm">
                              Timezone: {trigger.context.timezone}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm">Type: HTTP</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const pagesJobberJobTriggersRoute: RouteObject = {
  path: "/jobber/:jobName/triggers",
  Component: Component,
};
