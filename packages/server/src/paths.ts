import path from "path";
import { PATH_CONFIG } from "./constants.js";
import {
  ActionsTableType,
  JobVersionsTableType,
  RunnersTableType,
} from "./db/types.js";
import { sanitiseFilename } from "./util.js";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";

export function getJobActionArchiveDirectory() {
  return path.join(PATH_CONFIG, "action-archives");
}

export function getJobActionArchiveFile(
  version: Pick<JobVersionsTableType, "jobId" | "version">,
  action: Pick<ActionsTableType, "id">,
) {
  return path.join(
    getJobActionArchiveDirectory(),
    sanitiseFilename(`${version.version}_${action.id}.zip`),
  );
}

export function getPgDumpDirectory() {
  return path.join(PATH_CONFIG, "pg-dumps");
}

export function getRunnerEnvDirectory() {
  return path.join(tmpdir(), "jobber-env");
}

export function getRunnerEnvFile(runner: RunnersTableType) {
  return path.join(getRunnerEnvDirectory(), `${runner.id}.env`);
}

export async function ensureDirectoriesExist() {
  await mkdir(getJobActionArchiveDirectory(), {
    recursive: true,
  });

  await mkdir(getPgDumpDirectory(), {
    recursive: true,
  });

  await mkdir(getRunnerEnvDirectory(), {
    recursive: true,
  });
}
