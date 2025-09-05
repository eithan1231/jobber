import path from "path";
import { PATH_CONFIG } from "./constants.js";
import { ActionsTableType } from "./db/schema/actions.js";
import { JobVersionsTableType } from "./db/schema/job-versions.js";
import { sanitiseFilename } from "./util.js";

export function getJobActionArchiveDirectory() {
  return path.join(PATH_CONFIG, "action-archives");
}

export function getJobActionArchiveFile(
  version: JobVersionsTableType,
  action: ActionsTableType
) {
  return path.join(
    getJobActionArchiveDirectory(),
    sanitiseFilename(`${version.version}_${action.id}.zip`)
  );
}

export function getPgDumpDirectory() {
  return path.join(PATH_CONFIG, "pg-dumps");
}
