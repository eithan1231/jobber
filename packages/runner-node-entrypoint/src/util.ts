import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export function getUnixTimestamp() {
  return Math.floor(Date.now() / 1000);
}

export function getArgument(name: string): string {
  const arg = process.argv.find((arg) => arg.startsWith(`--${name}=`));

  if (!arg) {
    throw new Error(`Argument --${name} is required`);
  }

  return arg.split("=", 2)[1];
}

export function getTempFilePath({
  prefix = "jobber",
  extension = ".tmp",
  length = 16,
} = {}) {
  let filename = "";

  if (prefix) {
    filename += prefix;
    filename += "-";
  }

  filename += randomBytes(length).toString("hex");

  if (extension) {
    filename += ".";
    filename += extension;
  }

  return path.join(tmpdir(), extension);
}

export async function fileExists(path: string) {
  try {
    await stat(path);
    return true;
  } catch (err) {
    if (err instanceof Error) {
      if (
        "code" in err &&
        typeof err.code === "string" &&
        err.code === "ENOENT"
      ) {
        return false;
      }
    }

    throw err;
  }
}

export function unzip(
  source: string,
  destination: string,
  timeout: number = 60,
) {
  return new Promise((resolve, reject) => {
    const logs: string[] = [];

    let hasResolved = false;

    if (!path.isAbsolute(source)) {
      throw new Error("[unzip] Source must be absolute path");
    }

    if (!path.isAbsolute(destination)) {
      throw new Error("[unzip] Destination must be absolute path");
    }

    const proc = spawn(
      `unzip`,
      [
        // overwrite existing files without prompting
        "-o",
        source,
        "-d",
        destination,
      ],
      {
        stdio: "pipe",
      },
    );

    proc.stderr.on("data", (data) => logs.push(data.toString()));
    proc.stdout.on("data", (data) => logs.push(data.toString()));

    const timeoutInterval = setTimeout(() => {
      if (hasResolved) {
        return;
      }

      hasResolved = true;

      console.log(logs);

      reject(new Error(`[unzip] Timeout exceeded ${timeout}s`));

      proc.kill("SIGINT");
    }, timeout * 1000);

    proc.once("exit", (code) => {
      if (hasResolved) {
        return;
      }

      hasResolved = true;

      clearTimeout(timeoutInterval);

      if (code === 0) {
        return resolve(true);
      }

      console.log(logs);

      throw new Error(`[unzip] Failed with exit code ${code}`);
    });
  });
}
