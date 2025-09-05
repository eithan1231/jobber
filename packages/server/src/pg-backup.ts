import { CronTime } from "cron";
import { singleton } from "tsyringe";

import { LoopBase } from "~/loop-base.js";
import { getConfigOption } from "./config.js";
import { getPgDumpDirectory } from "./paths.js";

import { spawn } from "node:child_process";
import { readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";

function pgDump(filename: string) {
  return new Promise<void>((resolve, reject) => {
    const url = new URL(getConfigOption("DATABASE_URL"));

    const proc = spawn(`pg_dump`, [`--file=${filename}`], {
      env: {
        PGUSER: url.username,
        PGPASSWORD: url.password,
        PGHOST: url.hostname,
        PGPORT: url.port,
        PGDATABASE: url.pathname.slice(1),
      },

      stdio: "pipe",
    });

    proc.stdout.on("data", (data) => {
      console.log(`[pg_dump stdout]: ${data}`);
    });

    proc.stderr.on("data", (data) => {
      console.error(`[pg_dump stderr]: ${data}`);
    });

    proc.once("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`pg_dump exited with code ${code}`));
      }
    });
  });
}

@singleton()
export class PgBackup extends LoopBase {
  protected loopDuration = 1_000;
  protected loopStarting = undefined;
  protected loopStarted = undefined;
  protected loopClosing = undefined;
  protected loopClosed = undefined;

  private schedule: CronTime;
  private scheduledAt: number;

  constructor() {
    super();

    this.schedule = new CronTime(
      getConfigOption("DATABASE_BACKUP_SCHEDULE"),
      getConfigOption("DATABASE_BACKUP_SCHEDULE_TIMEZONE")
    );

    this.scheduledAt = this.schedule.sendAt().toMillis();
  }

  protected async loopIteration() {
    if (this.scheduledAt > Date.now()) {
      return;
    }

    this.scheduledAt = this.schedule.sendAt().toMillis();

    await this.createBackup("schedule");

    await this.cleanupBackups();
  }

  public async createBackup(name: string) {
    console.log(`[PgBackup/createBackup] Creating backup ${name}...`);

    try {
      const directory = getPgDumpDirectory();

      const date = new Date();

      const filename = path.join(
        directory,
        `${date.toLocaleDateString().replaceAll("/", "-")} ${date
          .toLocaleTimeString()
          .replaceAll(":", "-")
          .replaceAll(" ", "")} - ${name}.sql`
      );

      await pgDump(filename);
    } catch (err) {
      console.error(err);
    } finally {
      console.log(`[PgBackup/createBackup] done.`);
    }
  }

  public async cleanupBackups() {
    const directory = getPgDumpDirectory();

    const files = (
      await Promise.all(
        (
          await readdir(directory)
        ).map(async (file) => {
          const filename = path.join(directory, file);

          const filenameStats = await stat(filename);

          return {
            filename,
            createdAt: filenameStats.birthtimeMs,
          };
        })
      )
    ).sort((a, b) => a.createdAt - b.createdAt);

    const retentionCount = getConfigOption("DATABASE_BACKUP_RETENTION_COUNT");

    if (retentionCount === 0) {
      return;
    }

    if (files.length <= retentionCount) {
      return;
    }

    const filesToDelete = files.slice(0, files.length - retentionCount);

    console.log(
      `[PgBackup/cleanupBackups] Cleaning up ${filesToDelete.length} old backups...`
    );

    for (const file of filesToDelete) {
      console.log(
        `[PgBackup/cleanupBackups] Deleting old backup ${file.filename}...`
      );

      try {
        await unlink(file.filename);
      } catch (err) {
        console.log(
          `[PgBackup/cleanupBackups] Failed to delete old backup ${file.filename}: ${err}`
        );
      }
    }

    console.log(`[PgBackup/cleanupBackups] done.`);
  }
}
