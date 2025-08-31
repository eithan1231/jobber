import { spawn } from "child_process";
import { randomBytes } from "crypto";
import { tmpdir } from "os";
import path from "path";

export const getArgument = (name: string) => {
  const index = process.argv.indexOf(`--${name}`);

  if (index < 0) {
    return null;
  }

  if (typeof process.argv[index + 1] === "undefined") {
    return null;
  }

  return process.argv[index + 1];
};

export const timeout = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const getUnixTimestamp = () => Math.round(Date.now() / 1000);

export const shortenString = (input: string, maxLength = 20) => {
  if (input.length > maxLength) {
    return `${input.substring(0, maxLength - 5)}...${input.substring(
      input.length - 5
    )}`;
  }

  return input;
};

export const unzip = (
  source: string,
  destination: string,
  timeout: number = 60
) => {
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
