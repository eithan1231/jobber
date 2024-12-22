import path from "path";
import { ActionsTableType } from "./db/schema/actions.js";
import { PATH_CONFIG } from "./constants.js";
import { sanitiseFilename } from "./util.js";

export function getJobActionArchiveDirectory() {
  return path.join(PATH_CONFIG, "action-archives");
}

export function getJobActionArchiveFile(action: ActionsTableType) {
  return path.join(
    getJobActionArchiveDirectory(),
    sanitiseFilename(`${action.version}_${action.id}.zip`)
  );
}
