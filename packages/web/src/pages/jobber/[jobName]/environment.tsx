import { getJob, JobberJob } from "../../../api/jobber.js";
import { useEffect, useState } from "react";
import { RouteObject, useParams } from "react-router-dom";

const pagesJobberLandingComponent = () => {
  const params = useParams();

  const [job, setJob] = useState<JobberJob>();

  useEffect(() => {
    if (!params.jobName) {
      return;
    }

    getJob(params.jobName).then((result) => {
      if (result.success) {
        setJob(result.data);
      }
    });
  }, [params.jobName]);

  if (!job) {
    return "Please wait, loading..";
  }

  return (
    <div>
      <h1>{job.name}</h1>
    </div>
  );
};

export const pagesJobberJobEnvironmentRoute: RouteObject = {
  path: "/jobber/:jobName/environment",
  Component: pagesJobberLandingComponent,
};
