import assert from "assert";
import { randomBytes } from "crypto";
import { readFile } from "fs/promises";
import { Socket } from "net";
import { EventEmitter } from "events";

const FRAME_HEADER_SIZE_LENGTH = 6;
const FRAME_HEADER_MAGIC = "\xB0\x00\xB8\x88";
const FRAME_HEADER_LENGTH =
  FRAME_HEADER_MAGIC.length + FRAME_HEADER_SIZE_LENGTH;

/**
 * @param {string} name
 * @returns {string|null}
 */
const getArgument = (name) => {
  const index = process.argv.indexOf(`--${name}`);

  if (index < 0) {
    return null;
  }

  if (typeof process.argv[index + 1] === "undefined") {
    return null;
  }

  return process.argv[index + 1];
};

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getUnixTimestamp = () => Math.round(Date.now() / 1000);

export const shortenString = (input, maxLength = 20) => {
  if (input.length > maxLength) {
    return `${input.substring(0, maxLength - 5)}...${input.substring(
      input.length - 5
    )}`;
  }

  return input;
};

class JobberHandlerRequest {
  /**
   * @param {{
   *     type: "http" | "schedule" | "mqtt";
   *     headers: Record<string, string>;
   *     query: Record<string, string>;
   *     queries: Record<string, string[]>;
   *     path: string;
   *     method: string;
   *     body: string;
   *     bodyLength: number;
   * }} data
   */
  constructor(data) {
    /**
     * @private
     * @type {"http" | "schedule" | "mqtt"}
     */
    this._type = data.type;

    if (this._type === "http") {
      /**
       * HTTP Headers
       * @private
       * @type {Record<string, string>}
       */
      this._headers = data.headers;
    }

    if (this._type === "http") {
      /**
       * HTTP Query
       * @private
       * @type {Record<string, string>}
       */
      this._query = data.query;
    }

    if (this._type === "http") {
      /**
       * HTTP Queries
       * @private
       * @type {Record<string, string[]>}
       */
      this._queries = data.queries;
    }

    if (this._type === "http") {
      /**
       * HTTP Path
       * @private
       * @type {string}
       */
      this._path = data.path;
    }

    if (this._type === "http") {
      /**
       * HTTP Method
       * @private
       * @type {string}
       */
      this._method = data.method;
    }

    if (this._type === "mqtt") {
      /**
       * MQTT Topic
       * @private
       * @type {string}
       */
      this._topic = data.topic;
    }

    if (this._type === "http" || this._type == "mqtt") {
      /**
       * HTTP and MQTT Body
       * @private
       * @type {Buffer}
       */
      this._body = data.body
        ? Buffer.from(data.body, "base64")
        : Buffer.alloc(0);
    }

    if (this._type === "http" || this._type == "mqtt") {
      /**
       * HTTP and MQTT Body Length
       * @private
       * @type {number}
       */
      this._bodyLength = data.bodyLength;
    }
  }

  /**
   * @param {string} name
   * @returns {"schedule" | "http" | 'mqtt'}
   */
  type() {
    return this._type;
  }

  /**
   * @param {string} name
   * @returns {string | null}
   */
  header(name) {
    if (this._type !== "http") {
      throw new Error("[JobberHandlerRequest/header] Expecting type of http");
    }

    const key = name.toLowerCase();

    if (this._headers[key]) {
      return this._headers[key];
    }

    return null;
  }

  /**
   * @param {string} name
   * @returns {string | null}
   */
  query(name) {
    if (this._type !== "http") {
      throw new Error("[JobberHandlerRequest/header] Expecting type of http");
    }

    const key = name.toLowerCase();

    if (this._query[key]) {
      return this._query[key];
    }

    return null;
  }

  /**
   * @param {string} name
   * @returns {string[] | null}
   */
  queries(name) {
    if (this._type !== "http") {
      throw new Error("[JobberHandlerRequest/header] Expecting type of http");
    }

    const key = name.toLowerCase();

    if (this._queries[key]) {
      return this._queries[key];
    }

    return null;
  }

  /**
   * @returns {string}
   */
  method() {
    if (this._type !== "http") {
      throw new Error("[JobberHandlerRequest/header] Expecting type of http");
    }

    return this._method;
  }

  /**
   * @returns {string}
   */
  path() {
    if (this._type !== "http") {
      throw new Error("[JobberHandlerRequest/header] Expecting type of http");
    }

    return this._path;
  }

  /**
   * @returns {string}
   */
  topic() {
    if (this._type !== "mqtt") {
      throw new Error("[JobberHandlerRequest/header] Expecting type of mqtt");
    }

    return this._topic;
  }

  /**
   * @returns {unknown}
   */
  json() {
    if (this._type !== "http" && this._type !== "mqtt") {
      throw new Error("[JobberHandlerRequest/header] Expecting type of http");
    }

    return JSON.parse(this._body.toString());
  }

  /**
   * @returns {string}
   */
  text() {
    if (this._type !== "http" && this._type !== "mqtt") {
      throw new Error("[JobberHandlerRequest/header] Expecting type of http");
    }

    return this._body.toString();
  }

  /**
   * @returns {Buffer}
   */
  data() {
    if (this._type !== "http" && this._type !== "mqtt") {
      throw new Error("[JobberHandlerRequest/header] Expecting type of http");
    }

    return this._body;
  }
}

class JobberHandlerResponse {
  /**
   * @param {JobberHandlerRequest} request
   */
  constructor(request) {
    /**
     * @private
     * @type {JobberHandlerRequest}
     */
    this._request = request;

    if (this._request.type() === "http") {
      /**
       * @type {number}
       */
      this._status = 200;
    }

    if (this._request.type() === "http") {
      /**
       * @private
       * @type {Record<string, string>}
       */
      this._headers = {};
    }

    if (this._request.type() === "http") {
      /**
       * @private
       * @type {Buffer[]}
       */
      this._body = [];
    }

    if (this._request.type() === "mqtt") {
      /**
       * @private
       * @type {Array<{topic: string, body: Buffer}>}
       */
      this._publish = [];
    }
  }

  /**
   * HTTP Response Header
   * @param {string} name
   * @param {string} value
   * @returns {this}
   */
  header(name, value) {
    if (this._request.type() !== "http") {
      throw new Error("Expecting request type of http");
    }

    assert(typeof name === "string");
    assert(typeof value === "string");

    this._headers[name.toLowerCase()] = value;

    return this;
  }

  /**
   * HTTP Response Status
   * @param {number} status
   * @returns {this}
   */
  status(status) {
    if (this._request.type() !== "http") {
      throw new Error("Expecting request type of http");
    }

    assert(typeof status === "number");

    this._status = status;

    return this;
  }

  /**
   * HTTP Redirect
   * @param {string} path
   * @param {number} status
   * @returns {this}
   */
  redirect(path, status = 303) {
    if (this._request.type() !== "http") {
      throw new Error("Expecting request type of http");
    }

    assert(typeof path === "string");
    assert(typeof status === "number");

    this._headers["Location"] = path;

    this._status = status;

    return this;
  }

  /**
   * HTTP JSON response (application/json)
   * @param {any} data
   * @param {number} status
   * @returns {this}
   */
  json(data, status = 200) {
    if (this._request.type() !== "http") {
      throw new Error("Expecting request type of http");
    }

    assert(typeof status === "number");

    this.header("Content-Type", "text/json");

    this._body.push(Buffer.from(JSON.stringify(data)));

    this._status = status;

    return this;
  }

  /**
   * HTTP Text response (text/plain)
   * @param {string} data
   * @param {number} status
   * @returns {this}
   */
  text(data, status = 200) {
    if (this._request.type() !== "http") {
      throw new Error("Expecting request type of http");
    }

    assert(typeof data === "string");
    assert(typeof status === "number");

    this.header("Content-Type", "text/plain");

    this._body.push(Buffer.from(data));

    this._status = status;

    return this;
  }

  /**
   * HTTP Chunk of a response body
   * @param {Buffer} data
   * @param {number} status
   * @returns {this}
   */
  chunk(data) {
    if (this._request.type() !== "http") {
      throw new Error("Expecting request type of http");
    }

    assert(data instanceof Buffer);

    this._body.push(data);

    return this;
  }

  /**
   * MQTT Publish
   * @param {string} topic
   * @param {string | Buffer | any} body
   */
  publish(topic, body) {
    if (this._request.type() !== "mqtt") {
      throw new Error("Unable to publish to non-mqtt request");
    }

    assert(typeof topic === "string");

    if (typeof body === "string") {
      this._publish.push({
        topic,
        body: Buffer.from(body),
      });

      return;
    }

    if (body instanceof Buffer) {
      this._publish.push({
        topic,
        body: Buffer.from(body),
      });

      return;
    }

    if (typeof body === "object") {
      this._publish.push({
        topic,
        body: Buffer.from(JSON.stringify(body)),
      });

      return;
    }

    throw new Error("unexpected type of body");
  }
}

class JobberSocket extends EventEmitter {
  constructor() {
    super();

    /**
     * @type {Socket}
     */
    this.socket = new Socket();

    this.socket.setNoDelay(true);

    this.socket.on("data", (buffer) => {
      return this.onData(buffer);
    });

    this.socket.on("close", () => this.emit("close"));

    /**
     * @type {boolean}
     */
    this.isFlushing = false;

    /**
     * @type {Array<{
     *    frame: Buffer;
     *    callback: () => void;
     *  }>}
     */
    this.frameQueue = [];

    /**
     * @type {Buffer}
     */
    this.dataBuffer = Buffer.alloc(0);
  }

  /**
   * @public
   * @param {{ host: string; port: number }} options
   * @returns
   */
  connect(options) {
    return new Promise((resolve, reject) => {
      this.socket.connect({
        host: options.host,
        port: options.port,
      });
      this.socket.once("connect", () => {
        resolve(null);
      });
      this.socket.once("connectionAttemptFailed", () => {
        reject(new Error("Connection attempt failed"));
      });
    });
  }

  end(callback) {
    this.socket.end(callback);
  }

  /**
   * @public
   * @param {Buffer} buffer
   * @returns
   */
  writeFrame(buffer) {
    return new Promise((resolve, reject) => {
      this.frameQueue.push({
        frame: buffer,
        callback: () => resolve(null),
      });
      this.writeFrameFlusher();
    });
  }

  /**
   * @private
   */
  writeFrameFlusher() {
    if (this.isFlushing) {
      return;
    }
    this.isFlushing = true;
    try {
      while (true) {
        const queuedItems = this.frameQueue.splice(0);
        if (queuedItems.length === 0) {
          // Reached end of queue
          break;
        }
        for (const queuedItem of queuedItems) {
          const frame = queuedItem.frame;
          const header = Buffer.alloc(FRAME_HEADER_LENGTH);
          header.write(FRAME_HEADER_MAGIC, "ascii");
          header.writeIntLE(
            frame.length,
            FRAME_HEADER_MAGIC.length,
            FRAME_HEADER_SIZE_LENGTH
          );
          this.socket.write(header);
          const chunkSize = 1024;
          for (let i = 0; i < frame.length; i += chunkSize) {
            const start = i;
            const end = i + chunkSize;
            const data = frame.subarray(start, end);
            this.socket.write(data);
          }
          queuedItem.callback();
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * @private
   * @param {Buffer} buffer
   */
  onData(buffer) {
    this.dataBuffer = Buffer.concat([this.dataBuffer, buffer]);
    while (true) {
      const frameIndex = this.dataBuffer.indexOf(
        FRAME_HEADER_MAGIC,
        0,
        "ascii"
      );
      if (frameIndex < 0) {
        break;
      }
      if (this.dataBuffer.length - frameIndex < FRAME_HEADER_LENGTH) {
        break;
      }
      const length = this.dataBuffer.readIntLE(
        frameIndex + FRAME_HEADER_MAGIC.length,
        FRAME_HEADER_SIZE_LENGTH
      );
      const fullFrameSize = FRAME_HEADER_LENGTH + length;
      if (this.dataBuffer.length - frameIndex < fullFrameSize) {
        break;
      }
      const frame = Buffer.from(
        this.dataBuffer.subarray(
          frameIndex + FRAME_HEADER_LENGTH,
          frameIndex + fullFrameSize
        )
      );
      this.emit("frame", frame);
      this.dataBuffer = Buffer.from(
        this.dataBuffer.subarray(frameIndex + fullFrameSize)
      );
    }
  }
}

class Runner {
  /**
   * @param {string} hostname
   * @param {number} port
   * @param {string} runnerId
   */
  constructor(hostname, port, runnerId) {
    /**
     * @type {string}
     */
    this.hostname = hostname;

    /**
     * @type {number}
     */
    this.port = port;

    /**
     * @type {string}
     */
    this.runnerId = runnerId;

    /**
     * @type {boolean}
     */
    this.isShuttingDown = false;

    /**
     * @type {number}
     */
    this.handleRequestsProcessing = 0;

    this.socket = new JobberSocket();

    this.socket.on("frame", (frame) => {
      this.onFrame(frame);
    });
  }

  async connect() {
    await this.socket.connect({
      host: this.hostname,
      port: this.port,
    });

    this.writeFrame({
      name: "init",
      traceId: `trace-init-${randomBytes(16).toString("hex")}`,
      runnerId: this.runnerId,
    });
  }

  /**
   * @param {{
   * runnerId: string;
   * name: string;
   * traceId: string;
   * data: unknown;
   *}} frame
   */
  async writeFrame(frame) {
    const buffer = Buffer.from(JSON.stringify(frame));

    this.socket.writeFrame(buffer);
  }

  /**
   * @param {Buffer} buffer
   */
  async onFrame(buffer) {
    const { name, runnerId, traceId, data } = JSON.parse(
      buffer.toString("utf8")
    );

    if (name === "handle") {
      if (this.isShuttingDown) {
        console.warn(
          `[Runner/onFrame] ${name} event received while shutting down`
        );
        return;
      }

      await this.onFrameHandle(traceId, data);

      return;
    }

    if (name === "shutdown") {
      await this.onFrameShutdown(traceId, data);

      return;
    }

    throw new Error(`Unexpected transaction name ${name}`);
  }

  /**
   * @param {string} traceId
   * @param {any} data
   */
  async onFrameHandle(traceId, data) {
    const start = performance.now();

    this.handleRequestsProcessing++;

    console.log(
      `[Runner/onFrameHandle] Starting, traceId ${shortenString(traceId)}`
    );

    try {
      const packageJson = JSON.parse(await readFile("./package.json"));

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

      const responseData = {
        success: true,
        duration: performance.now() - start,
      };

      if (jobberRequest.type() === "http") {
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
        responseData.mqtt = {
          publish: jobberResponse._publish.map((index) => ({
            topic: index.topic,
            body: index.body.toString("base64"),
          })),
        };
      }

      await this.writeFrame({
        name: "handle-response",
        runnerId: this.runnerId,
        traceId: traceId,
        data: responseData,
      });

      console.log(
        "[Runner/onFrameHandle] Delivered response, traceId",
        shortenString(traceId)
      );
    } catch (err) {
      console.log(
        "[Runner/onFrameHandle] Failed due to error, traceId",
        shortenString(traceId)
      );

      console.error(err);

      await this.writeFrame({
        name: "handle-response",
        runnerId: this.runnerId,
        traceId: traceId,
        data: {
          success: false,
          duration: performance.now() - start,
          error: err.toString(),
        },
      });
    } finally {
      this.handleRequestsProcessing--;
    }
  }

  /**
   * @param {string} traceId
   * @param {any} data
   */
  async onFrameShutdown(traceId, data) {
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

const main = async () => {
  const jobRunnerIdentifier = getArgument("job-runner-identifier");
  const jobControllerHost = getArgument("job-controller-host");
  const jobControllerPort = Number(getArgument("job-controller-port"));

  const jobber = new Runner(
    jobControllerHost,
    jobControllerPort,
    jobRunnerIdentifier
  );

  await jobber.connect();

  const shutdownRoutine = async () => {
    console.log("[main/shutdownRoutine] Received shutdown signal");

    await jobber.onFrameShutdown(randomBytes(16).toString("hex"), {});

    console.log("[main/shutdownRoutine] Finished! Goodbye!");
  };

  process.once("SIGTERM", async () => {
    await shutdownRoutine();
  });

  process.once("SIGINT", async () => {
    await shutdownRoutine();
  });
};

main();
