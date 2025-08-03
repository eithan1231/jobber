import { JobberGenericResponse } from "./common";

export type JobberConfig = {
  jobberName: string;
  features: {
    metricsEnabled: boolean;
    actionDockerArgumentVolumesEnabled: boolean;
    actionDockerArgumentNetworksEnabled: boolean;
    actionDockerArgumentLabelsEnabled: boolean;
    actionDockerArgumentMemoryLimitEnabled: boolean;
    actionDockerArgumentDirectPassthroughEnabled: boolean;
  };
};

export const getConfig = async (): Promise<
  JobberGenericResponse<JobberConfig>
> => {
  const result = await fetch("/api/config");
  return await result.json();
};
