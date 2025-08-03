import { JobberGenericResponse } from "./common";

export type JobberDecoupledStatus = {
  status: "healthy" | "unhealthy" | "unknown";
  message: string;
  created: number;
  updated: number;
  ttl?: number;
};

export const getDecoupledStatus = async (
  key: string
): Promise<JobberGenericResponse<JobberDecoupledStatus>> => {
  const result = await fetch(`/api/decoupled-status/${key}`);

  return await result.json();
};
