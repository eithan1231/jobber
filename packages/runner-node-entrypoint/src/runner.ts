import assert from "assert";
import { randomBytes } from "crypto";
import { readFile, writeFile } from "fs/promises";
import { TcpFrameSocket } from "@jobber/tcp-frame-socket";
import { getTmpFile, shortenString, timeout, unzip } from "./util.js";
import { JobberHandlerRequest } from "./request.js";
import { JobberHandlerResponse } from "./response.js";

type FrameJson = {
  runnerId: string;
  name: string;
  traceId: string;
  dataType: "buffer" | "json";
};

export class Runner {
  private hostname: string;
  private port: number;
  private runnerId: string;

  private isShuttingDown: boolean = false;
  private handleRequestsProcessing: number = 0;

  private socket: TcpFrameSocket;

  private traceResponses = new Map<
    string,
    (frame: FrameJson, data: Buffer) => void
  >();

  constructor(hostname: string, port: number, runnerId: string) {
    this.hostname = hostname;
    this.port = port;
    this.runnerId = runnerId;

    this.socket = new TcpFrameSocket();

    this.socket.on("frame", (frame) => {
      this.onFrame(frame);
    });

    this.socket.on("close", () => {
      console.log("[Runner] Received close events!");
    });
  }

  async connect() {
    await this.socket.connect({
      host: this.hostname,
      port: this.port,
    });

    const traceId = `InitTraceId-${randomBytes(16).toString("hex")}`;

    this.traceResponses.set(traceId, async (frame, data) => {
      assert(frame.dataType === "buffer");

      const zipFile = getTmpFile({ extension: "zip" });

      await writeFile(zipFile, data);

      await unzip(zipFile, process.cwd());

      await this.writeFrame(
        {
          name: "ready",
          runnerId: frame.runnerId,
          traceId: `ready-${randomBytes(16).toString("hex")}`,
          dataType: "buffer",
        },
        Buffer.alloc(0)
      );

      return;
    });

    await this.writeFrame(
      {
        name: "init",
        traceId: traceId,
        runnerId: this.runnerId,
        dataType: "buffer",
      },
      Buffer.alloc(0)
    );
  }

  async writeFrame(frame: FrameJson, data: Buffer) {
    const buffer = Buffer.concat([
      Buffer.from(JSON.stringify(frame)),
      Buffer.from("\n"),
      data,
    ]);

    await this.socket.writeFrame(buffer);
  }

  async onFrame(buffer: Buffer) {
    const separator = buffer.indexOf("\n");

    assert(separator > 0);

    const chunkJson = buffer.subarray(0, separator);
    const bodyBuffer = buffer.subarray(separator + 1);

    const frame = JSON.parse(chunkJson.toString("utf8")) as FrameJson;

    if (frame.name === "response") {
      const traceResponseCallback = this.traceResponses.get(frame.traceId);

      if (!traceResponseCallback) {
        return;
      }

      traceResponseCallback(frame, bodyBuffer);

      return;
    }

    if (frame.name === "handle") {
      if (this.isShuttingDown) {
        console.warn(
          `[Runner/onFrame] ${frame.name} event received while shutting down`
        );
        return;
      }

      assert(frame.dataType === "json");

      const data = JSON.parse(bodyBuffer.toString());

      await this.onFrameHandle(frame, data);

      return;
    }

    if (frame.name === "shutdown") {
      await this.onFrameShutdown(frame.traceId);

      return;
    }

    throw new Error(`Unexpected transaction name ${frame.name}`);
  }

  async onFrameHandle(frame: FrameJson, data: any) {
    const start = performance.now();

    this.handleRequestsProcessing++;

    console.log(
      `[Runner/onFrameHandle] Starting, traceId ${shortenString(frame.traceId)}`
    );

    try {
      const packageJson = JSON.parse(await readFile("./package.json", "utf8"));

      if (typeof packageJson.main !== "string") {
        throw new Error(
          "Failed to load package.json, property 'main' is not present or not a string"
        );
      }

      const clientModule = await import(packageJson.main);

      const jobberRequest = new JobberHandlerRequest(data);
      const jobberResponse = new JobberHandlerResponse(jobberRequest);

      if (jobberRequest.type() === "http") {
        console.log(
          `[Runner/onFrameHandle] HTTP ${jobberRequest.method()} ${jobberRequest.path()}`
        );
      }

      if (jobberRequest.type() === "schedule") {
        console.log(`[Runner/onFrameHandle] Schedule`);
      }

      if (jobberRequest.type() === "mqtt") {
        console.log(`[Runner/onFrameHandle] MQTT ${jobberRequest.topic()}`);
      }

      await clientModule.handler(jobberRequest, jobberResponse);

      const responseData: any = {
        success: true,
        duration: performance.now() - start,
      };

      if (jobberRequest.type() === "http") {
        assert(jobberResponse._body);

        responseData.http = {
          status: jobberResponse._status,
          headers: jobberResponse._headers,
          body: Buffer.concat(jobberResponse._body).toString("base64"),
        };
      }

      if (jobberRequest.type() === "schedule") {
        //
      }

      if (jobberRequest.type() === "mqtt") {
        assert(jobberResponse._publish);

        responseData.mqtt = {
          publish: jobberResponse._publish.map((index) => ({
            topic: index.topic,
            body: index.body.toString("base64"),
          })),
        };
      }

      await this.writeFrame(
        {
          name: "response",
          runnerId: this.runnerId,
          traceId: frame.traceId,
          dataType: "json",
        },
        Buffer.from(JSON.stringify(responseData))
      );

      console.log(
        "[Runner/onFrameHandle] Delivered response, traceId",
        shortenString(frame.traceId)
      );
    } catch (err) {
      if (!(err instanceof Error)) {
        console.log(err);
        return;
      }

      console.log(
        "[Runner/onFrameHandle] Failed due to error, traceId",
        shortenString(frame.traceId)
      );

      console.error(err);

      await this.writeFrame(
        {
          name: "response",
          runnerId: this.runnerId,
          traceId: frame.traceId,
          dataType: "json",
        },
        Buffer.from(
          JSON.stringify({
            success: false,
            duration: performance.now() - start,
            error: err.toString(),
          })
        )
      );
    } finally {
      this.handleRequestsProcessing--;
    }
  }

  async onFrameShutdown(traceId: string) {
    console.log("[Runner/onFrameShutdown] Starting shutdown routine");

    this.isShuttingDown = true;

    while (this.handleRequestsProcessing > 0) {
      await timeout(100);
    }

    this.socket.end(() => {
      process.exit();
    });
  }
}
