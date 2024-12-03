import path from "path";
import { PATH_CONFIG_JOBS } from "./constants.js";
import { sanitiseFilename } from "./util.js";

/**
 * Get /jobs/{name}/
 */
export const getPathJobDirectory = (jobName: string) => {
  return path.join(PATH_CONFIG_JOBS, sanitiseFilename(jobName));
};

/**
 * Get /jobs/{name}/config.json
 */
export const getPathJobConfigFile = (jobName: string) => {
  return path.join(getPathJobDirectory(jobName), "config.json");
};

/**
 * Get /jobs/{name}/environment.json
 */
export const getPathJobEnvironmentFile = (jobName: string) => {
  return path.join(getPathJobDirectory(jobName), "environment.json");
};

/**
 * Get /jobs/{name}/actions/
 */
export const getPathJobActionsDirectory = (jobName: string) => {
  return path.join(getPathJobDirectory(jobName), "actions");
};

/**
 * Get /jobs/{name}/triggers/
 */
export const getPathJobTriggersDirectory = (jobName: string) => {
  return path.join(getPathJobDirectory(jobName), "triggers");
};

/**
 * Get /jobs/{name}/logs/
 */
export const getPathJobLogsDirectory = (jobName: string) => {
  return path.join(getPathJobDirectory(jobName), "logs");
};

/**
 * Get /jobs/{name}/actions/{actionId}.json
 */
export const getPathJobActionsFile = (jobName: string, actionId: string) => {
  return path.join(
    getPathJobActionsDirectory(jobName),
    sanitiseFilename(`${actionId}.json`)
  );
};

/**
 * Get /jobs/{name}/actions/{actionId}.zip
 */
export const getPathJobActionsArchiveFile = (
  jobName: string,
  actionId: string
) => {
  return path.join(
    getPathJobActionsDirectory(jobName),
    sanitiseFilename(`${actionId}.zip`)
  );
};

/**
 * Get /jobs/{name}/actions/{actionId}/runners/{runnerId}/
 */
export const getPathJobActionRunnerDirectory = (
  jobName: string,
  actionId: string,
  runnerId: string
) => {
  return path.join(
    getPathJobActionsDirectory(jobName),
    sanitiseFilename(actionId),
    "runners",
    sanitiseFilename(runnerId)
  );
};

/**
 * Get /jobs/{name}/triggers/{triggerId}.json
 */
export const getPathJobTriggersFile = (jobName: string, triggerId: string) => {
  return path.join(
    getPathJobTriggersDirectory(jobName),
    sanitiseFilename(`${triggerId}.json`)
  );
};

/**
 * Get /jobs/{name}/logs/output.log
 */
export const getPathJobLogsFile = (jobName: string) => {
  return path.join(getPathJobLogsDirectory(jobName), "output.log");
};
