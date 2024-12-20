import { spawn } from "child_process";

export type GetDockerContainers = Array<{
  Command: string;
  CreatedAt: string;
  ID: string;
  Image: string;
  Labels: string;
  LocalVolumes: string;
  Mounts: string;
  Names: string;
  Networks: string;
  ports: string;
  RunningFor: string;
  Size: string;
  State: string;
  Status: string;
}>;

export const getDockerContainers = (): Promise<GetDockerContainers> => {
  return new Promise((resolve, reject) => {
    const lines: string[] = [];

    const process = spawn("docker", ["container", "ls", "--format", "json"]);

    process.stdout.on("data", (chunk: Buffer) => {
      lines.push(chunk.toString());
    });

    process.once("exit", (code) => {
      const output = lines.join("").split("\n");

      if (code !== 0) {
        return reject(
          new Error("Failed to get Docker Containers!", {
            cause: output,
          })
        );
      }

      resolve(
        output
          .filter((index) => !!index)
          .map((outputLine) => JSON.parse(outputLine))
      );
    });
  });
};

export const stopDockerContainer = (id: string): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    const lines: string[] = [];

    const process = spawn("docker", ["container", "stop", id]);

    process.stdout.on("data", (chunk: Buffer) => {
      lines.push(chunk.toString());
    });

    process.once("exit", (code) => {
      return resolve(code === 0);
    });
  });
};
