import path from "path";
import { spawn } from "child_process";
import { tmpdir } from "os";
import { publicDecrypt, randomBytes } from "crypto";
import { Readable, Writable } from "stream";
import { ReadableStream } from "stream/web";
import { readFile, rm, stat } from "fs/promises";
import { PATH_CONFIG_JOBS } from "./constants.js";
import { z } from "zod";

export const getUnixTimestamp = () => Math.round(Date.now() / 1000);

export const timeout = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Awaits until the callback yields true
 */
export const awaitTruthy = async (
  callback: () => Promise<boolean>,
  timeoutMs: number = 30_000
) => {
  let startTime = Date.now();

  let index = 0;
  while (true) {
    if (Date.now() - startTime > timeoutMs) {
      return false;
    }

    if (await callback()) {
      return true;
    }

    index++;

    if (index <= 10) {
      await timeout(10);
    }

    if (index > 10 && index <= 20) {
      await timeout(20);
    }

    if (index > 20) {
      await timeout(100);
    }
  }
};

export const sanitiseFilename = (filename: string) => {
  return filename.replaceAll(/[^0-9a-z-_ .]/gi, "").substring(0, 255);
};

export const unzip = (
  source: string,
  destination: string,
  timeout: number = 60
) => {
  return new Promise((resolve, reject) => {
    console.log(
      `[unzip] Extracting, source ${presentablePath(
        source
      )} destination ${presentablePath(destination)}`
    );

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
      }
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
        console.log(`[unzip] Finished successfully`);

        return resolve(true);
      }

      console.log(logs);

      throw new Error(`[unzip] Failed with exit code ${code}`);
    });
  });
};

export const getTmpFile = ({ extension = "", length = 16 }) => {
  let filename = randomBytes(length).toString("hex");

  if (extension) {
    filename += `.${extension}`;
  }

  return path.join(tmpdir(), filename);
};

export const handleReadableStreamPipe = (
  source: ReadableStream,
  destination: Writable
) => {
  return new Promise((resolve, reject) => {
    let resolved = false;

    const sourceStream = Readable.fromWeb(source, {
      objectMode: false,
    });

    sourceStream.pipe(destination);

    sourceStream.once("error", (err) => {
      destination.destroy();

      if (resolved) {
        return;
      }

      resolved = true;

      return reject(err);
    });

    destination.once("error", (err) => {
      destination.destroy();
      sourceStream.destroy();

      if (resolved) {
        return;
      }

      resolved = true;

      return reject(err);
    });

    destination.once("finish", () => {
      if (resolved) {
        return;
      }

      resolved = true;

      return resolve(null);
    });
  });
};

export const fileExists = async (filename: string) => {
  try {
    if (!path.isAbsolute(filename)) {
      throw new Error("Must be absolute filename");
    }

    await stat(filename);

    return true;
  } catch (err: any) {
    if (err.code === "ENOENT") {
      return false;
    }

    throw err;
  }
};

export const createToken = (options: { prefix?: string; length?: number }) => {
  if (options.prefix) {
    return `${options.prefix}-${randomBytes(options.length ?? 16).toString(
      "hex"
    )}`;
  }

  return randomBytes(options.length ?? 16).toString("hex");
};

export const shortenString = (input: string, maxLength = 16) => {
  if (input.length > maxLength) {
    return `${input.substring(0, maxLength)}...`;
  }

  return input;
};

export const presentablePath = (path: string) => {
  const cwd = process.cwd();

  let result = path;

  if (result.startsWith(cwd)) {
    result = `.${result.substring(cwd.length)}`;
  }

  result = result
    .split("/")
    .map((segment) => shortenString(segment))
    .join("/");

  return result;
};
