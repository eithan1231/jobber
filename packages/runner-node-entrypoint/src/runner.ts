import * as grpcRunner from "@jobber/grpc/basics/runner.js";
import assert from "node:assert";
import { open, readFile } from "node:fs/promises";
import path from "node:path";
import { HttpContext } from "./context/http.js";
import { MqttContext } from "./context/mqtt.js";
import { ScheduleContext } from "./context/schedule.js";
import { RunnerClient } from "./runner-client.js";
import { RunnerServer } from "./runner-server.js";
import { fileExists, getTempFilePath, unzip } from "./util.js";
import { validatePackageJson } from "./validator.js";
import { Telemetry } from "./telemetry.js";
import { deferred, Deferred } from "@jobber/common/deferred.js";
import { RunnerOptions } from "./options.js";

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

  private _statusPromise: {
    starting: Deferred<void>;
    running: Deferred<void>;
    closing: Deferred<void>;
    pending: Deferred<void>;
  };

  protected _server: RunnerServer;

  protected _client: RunnerClient;

  protected _telemetry: Telemetry;

  private runnerInfo: grpcRunner.Item | null = null;

  private _module: RunnerExpectedModule | null = null;

  constructor(private options: RunnerOptions) {
    this._statusPromise = {
      starting: deferred(),
      running: deferred(),
      closing: deferred(),
      pending: deferred(),
    };

    this._telemetry = new Telemetry();

    this._client = new RunnerClient(this, options);

    this._server = new RunnerServer(this, options);
  }

  async start() {
    this._status = "starting";
    this._statusPromise.starting.resolve();

    await this._client.start();

    await this._server.start();

    await this.bootstrap();

    this._status = "running";
    this._statusPromise.running.resolve();
  }

  async stop() {
    this._status = "closing";
    this._statusPromise.closing.resolve();

    if (this.options.runnerDebug) {
      console.info("Shutting down gRPC server...");
    }

    await this._server.stop();

    if (this.options.runnerDebug) {
      console.info("gRPC server shut down successfully.");
      console.info("Shutting down gRPC client...");
    }

    await this._client.stop();

    if (this.options.runnerDebug) {
      console.info("gRPC client shut down successfully.");
    }

    this._status = "pending";
    this._statusPromise.pending.resolve();

    this._statusPromise = {
      starting: deferred(),
      running: deferred(),
      closing: deferred(),
      pending: deferred(),
    };
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

  public get telemetry() {
    return this._telemetry;
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

  public get statusPromises() {
    return this._statusPromise;
  }
}
