import { spawn } from "child_process";
import { hash, randomBytes } from "crypto";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { Context } from "hono";
import { tmpdir } from "os";
import path from "path";
import { Readable, Writable } from "stream";
import { ReadableStream } from "stream/web";
import { getConfigOption } from "./config.js";

export const getUnixTimestamp = () => Math.round(Date.now() / 1000);

export const sanitiseFilename = (filename: string) => {
  return filename.replaceAll(/[^0-9a-z-_ .]/gi, "").substring(0, 255);
};

/**
 * Enforces only alpha-numeric with "_" and "-" characters
 */
export const sanitiseSafeCharacters = (name: string) => {
  return name.replaceAll(/[^0-9a-z-_]/gi, "");
};

export const unzip = (
  source: string,
  destination: string,
  timeout: number = 60,
) => {
  return new Promise((resolve, reject) => {
    console.log(
      `[unzip] Extracting, source ${presentablePath(
        source,
      )} destination ${presentablePath(destination)}`,
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
        "-o", // overwrite existing files without prompting
        source, // source file
        "-d", // specify destination
        destination, // destination folder
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
  destination: Writable,
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
    return `${options.prefix}-${secureRandomBytes(
      options.length ?? 16,
    ).toString("hex")}`;
  }

  return secureRandomBytes(options.length ?? 16).toString("hex");
};

export const shortenString = (input: string, maxLength = 20) => {
  if (input.length > maxLength) {
    return `${input.substring(0, maxLength - 5)}...${input.substring(
      input.length - 5,
    )}`;
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

export const readFileLines = (
  filename: string,
  callbackLine: (line: string) => void,
) => {
  return new Promise((resolve, reject) => {
    const stream = createReadStream(filename);
    let leftover = "";

    stream.on("data", (chunk) => {
      const data = leftover + chunk.toString();
      const lines = data.split("\n");

      for (let i = 0; i < lines.length - 1; i++) {
        callbackLine(lines[i]);
      }

      leftover = lines[lines.length - 1];
    });

    stream.on("end", () => {
      if (leftover) {
        callbackLine(leftover);
      }

      resolve(true);
    });

    stream.on("error", (err) => {
      reject(err);
    });
  });
};

export const createSha1Hash = (input: string) => {
  return hash("sha1", input);
};

export const createBenchmark = () => {
  const start = performance.now();

  return () => performance.now() - start;
};

export const secureRandomBytes = (length: number) => {
  const result = new Uint8Array(length);
  crypto.getRandomValues(result);
  return Buffer.from(result);
};

export const getAbsoluteUrl = (c: Context, path: string) => {
  const proto = c.req.header("x-forwarded-proto") || "http";
  const host = c.req.header("x-forwarded-host") || c.req.header("host");

  if (!host) {
    throw new Error("Unable to determine host for absolute url");
  }

  if (getConfigOption("ALLOWED_HOSTS").length >= 1) {
    const allowedHosts = getConfigOption("ALLOWED_HOSTS");

    if (!allowedHosts.includes(host.toLowerCase())) {
      throw new Error(`Host ${host} is not in allowed hosts list`);
    }
  }

  return `${proto}://${host}${path}`;
};
