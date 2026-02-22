import { RunnerClient } from "./runner-client.js";
import { RunnerServer } from "./runner-server.js";
import * as grpcRunner from "@jobber/grpc/basics/runner.js";
import { fileExists, getTempFilePath, unzip } from "./util.js";
import { open, readFile } from "node:fs/promises";
import path from "node:path";
import { validatePackageJson } from "./validator.js";
import assert from "node:assert";
import { HttpContext } from "./context/http.js";
import { ScheduleContext } from "./context/schedule.js";
import { MqttContext } from "./context/mqtt.js";

export type RunnerOptions = {
  runnerId: string;
  runnerClientId: string;
  runnerClientSecret: string;
  runnerGeneralApiEndpoint: string;

  runnerOAuthTokenEndpoint: string;
  runnerOAuthJwksEndpoint: string;
  runnerOAuthIssuer: string;
  runnerOAuthAudience: string;

  runnerApiPort: number;

  runnerDebug: boolean;
};

type Status = "pending" | "starting" | "running" | "closing";

type RunnerExpectedModule = {
  handler?: (
    request: unknown,
    response: unknown,
    context: unknown,
  ) => Promise<unknown> | unknown;

  bootstrap?: () => Promise<void> | void;

  handlerHttp?: (context: HttpContext) => Promise<unknown> | unknown;

  handlerSchedule?: (context: ScheduleContext) => Promise<unknown> | unknown;

  handlerMqtt?: (context: MqttContext) => Promise<unknown> | unknown;
};

export class Runner {
  private _status: Status = "pending";

  protected _server: RunnerServer;

  protected _client: RunnerClient;

  private runnerInfo: grpcRunner.Item | null = null;

  private _module: RunnerExpectedModule | null = null;

  constructor(private options: RunnerOptions) {
    this._client = new RunnerClient(this, options);

    this._server = new RunnerServer(this, options);
  }

  async start() {
    this._status = "starting";

    await this._client.start();

    await this._server.start();

    await this.bootstrap();

    this._status = "running";
  }

  async stop() {
    this._status = "closing";

    await this._server.stop();

    await this._client.stop();

    this._status = "pending";
  }

  async populateRunnerInfo() {
    const runnerResponse = await this._client.methods.getRunner({
      runnerId: this.options.runnerId,
    });

    if (!runnerResponse || !runnerResponse.runner) {
      throw new Error(`Runner with ID ${this.options.runnerId} not found`);
    }

    this.runnerInfo = runnerResponse.runner;
  }

  async downloadArchive() {
    assert(
      this.runnerInfo,
      "Runner info must be populated before bootstrapping",
    );

    const archiveStream = this._client.methods.getJobVersionArchive({
      jobVersionId: this.runnerInfo.versionId,
      jobId: this.runnerInfo.jobId,
    });

    const archiveFilename = getTempFilePath({
      extension: "zip",
    });

    const archiveHandle = await open(archiveFilename, "w");

    try {
      for await (const chunk of archiveStream) {
        await archiveHandle.write(chunk.data);

        if (chunk.end) {
          await archiveHandle.close();
        }
      }

      return archiveFilename;
    } catch (err) {
      await archiveHandle.close();

      throw err;
    }
  }

  async bootstrap() {
    await this.populateRunnerInfo();

    const archiveFilename = await this.downloadArchive();

    await unzip(archiveFilename, process.cwd());

    const pathPackageJson = path.join(process.cwd(), "package.json");

    if (!(await fileExists(pathPackageJson))) {
      throw new Error("package.json not found in job archive");
    }

    const contentPackageJson = await readFile(pathPackageJson, "utf8");
    const contentPackageJsonParsed = JSON.parse(contentPackageJson);
    const contentPackageJsonValidated = validatePackageJson(
      contentPackageJsonParsed,
    );

    if (!contentPackageJsonValidated.success) {
      throw new Error(
        `package.json validation failed: ${contentPackageJsonValidated.errors.join(
          ", ",
        )}`,
      );
    }

    const pathMain = path.join(
      process.cwd(),
      contentPackageJsonValidated.data.main || "index.js",
    );

    const module = (await import(pathMain)) as RunnerExpectedModule;

    // Validate it has at least one handler
    if (
      typeof module.handler !== "function" &&
      typeof module.handlerHttp !== "function" &&
      typeof module.handlerSchedule !== "function" &&
      typeof module.handlerMqtt !== "function"
    ) {
      throw new Error(
        "No handler function found. Please export a handler, handlerHttp, handlerSchedule, or handlerMqtt function.",
      );
    }

    if (typeof module.bootstrap === "function") {
      const bootstrapResult = module.bootstrap();

      if (bootstrapResult instanceof Promise) {
        await bootstrapResult;
      }
    }

    this._module = module;
  }

  public get status() {
    return this._status;
  }

  public get server() {
    return this._server;
  }

  public get client() {
    return this._client;
  }

  public get module() {
    if (!this._module) {
      throw new Error("Module not loaded yet");
    }

    return this._module;
  }

  public get jobId() {
    if (!this.runnerInfo) {
      throw new Error("Runner info not loaded yet");
    }

    return this.runnerInfo.jobId;
  }
}
