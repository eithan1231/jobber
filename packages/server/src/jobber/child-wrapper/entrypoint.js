import assert from "assert";
import { randomBytes } from "crypto";
import { readFile } from "fs/promises";
import { Socket } from "net";

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

class JobberSocket {
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

    this.socket = new Socket();

    /**
     * @type {{
     *  [traceId: string]: {
     *    name: string;
     *    traceId: string;
     *    encoding: 'json' | 'binary' | 'unknown';
     *    createdAt: number;
     *    modifiedAt: number;
     *    chunks: Array<Buffer>;
     *  }
     * }}
     */
    this.transactionChunks = {};
  }

  connect() {
    this.socket.connect({
      host: this.hostname,
      port: this.port,
      noDelay: true,
    });

    this.socket.once("connect", () => {
      console.log(`[JobberSocket/connect] Connected successfully`);

      this.writeJson("init", `trace-init-${randomBytes(16).toString("hex")}`, {
        type: "init",
        id: this.runnerId,
      });
    });

    this.socket.on("data", (data) => {
      this.onData(data);
    });
  }

  /**
   * @param {Buffer} data
   */
  onData(data) {
    let firstLineIndex = data.indexOf("\n");

    if (firstLineIndex < 0) {
      throw new Error("Failed to parse first line!");
    }

    const firstLine = data.subarray(0, firstLineIndex).toString("utf8");

    const metadata = this.parseFirstLine(firstLine);

    const dataChunk = data.subarray(firstLineIndex + 1);

    if (metadata.isStart && metadata.isEnd) {
      this.onTransaction(metadata.name, metadata.traceId, metadata.encoding, [
        dataChunk,
      ]);

      return;
    }

    if (metadata.isStart) {
      this.transactionChunks[metadata.traceId] = {
        name: metadata.name,
        encoding: metadata.encoding,
        traceId: metadata.traceId,
        createdAt: getUnixTimestamp(),
        modifiedAt: getUnixTimestamp(),
        chunks: [dataChunk],
      };

      return;
    }

    if (metadata.isEnd) {
      this.transactionChunks[metadata.traceId].chunks.push(dataChunk);

      this.onTransaction(
        this.transactionChunks[metadata.traceId].name,
        this.transactionChunks[metadata.traceId].traceId,
        this.transactionChunks[metadata.traceId].encoding,
        this.transactionChunks[metadata.traceId].chunks
      );

      delete this.transactionChunks[metadata.traceId];

      return;
    }

    this.transactionChunks[metadata.traceId].chunks.push(dataChunk);
  }

  /**
   * @param {string} name
   * @param {string} traceId
   * @param {'json' | 'binary' | 'unknown'} encoding
   * @param {Array<Buffer>} data
   */
  onTransaction(name, traceId, encoding, data) {
    const buffer = Buffer.concat(data);

    if (name === "handle") {
      if (encoding !== "json") {
        throw new Error(`Expected encoding to be json, got ${encoding}`);
      }

      if (this.isShuttingDown) {
        console.warn(
          `[JobberSocket/onTransaction] ${name} event received while shutting down`
        );

        return;
      }

      this.onTransaction_Handle(traceId, JSON.parse(buffer));

      return;
    }

    if (name === "handle-setup") {
      if (encoding !== "json") {
        throw new Error(`Expected encoding to be json, got ${encoding}`);
      }

      if (this.isShuttingDown) {
        console.warn(
          `[JobberSocket/onTransaction] ${name} event received while shutting down`
        );

        return;
      }

      this.onTransaction_Handle(traceId, JSON.parse(buffer));

      return;
    }

    if (name === "shutdown") {
      this.onTransaction_Shutdown(traceId, JSON.parse(buffer));

      return;
    }

    throw new Error(`Unexpected transaction name ${name}`);
  }

  /**
   * @param {string} traceId
   * @param {any} data
   */
  async onTransaction_Handle(traceId, data) {
    const start = performance.now();

    this.handleRequestsProcessing++;

    console.log(
      `[JobberSocket/onTransaction_Handle] Starting, traceId ${traceId}`
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
          `[JobberSocket/onTransaction_Handle] HTTP ${jobberRequest.method()} ${jobberRequest.path()}`
        );
      }

      if (jobberRequest.type() === "schedule") {
        console.log(`[JobberSocket/onTransaction_Handle] Schedule`);
      }

      if (jobberRequest.type() === "mqtt") {
        console.log(
          `[JobberSocket/onTransaction_Handle] MQTT ${jobberRequest.topic()}`
        );
      }

      await clientModule.handler(jobberRequest, jobberResponse);

      console.log(
        `[JobberSocket/onTransaction_Handle] Handler completed, traceId ${traceId}`
      );

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

      await this.writeJson("handle-response", traceId, responseData);

      console.log(
        "[JobberSocket/onTransaction_Handle] Delivered response, traceId",
        traceId
      );
    } catch (err) {
      console.log(
        "[JobberSocket/onTransaction_Handle] Failed due to error, traceId",
        traceId
      );

      console.error(err);

      await this.writeJson("handle-response", traceId, {
        success: false,
        duration: performance.now() - start,
        error: err.toString(),
      });
    } finally {
      this.handleRequestsProcessing--;
    }
  }

  /**
   * @param {string} traceId
   * @param {any} data
   */
  async onTransaction_Shutdown(traceId, data) {
    this.isShuttingDown = true;

    console.log(
      "[JobberSocket/onTransaction_Shutdown] Starting shutdown routine"
    );

    while (this.handleRequestsProcessing > 0) {
      await timeout(100);
    }

    this.socket.end(() => {
      process.exit();
    });
  }

  /**
   * @param {string} name
   * @param {string} traceId
   * @param {any} data
   * @returns {Promise<void>}
   */
  async writeJson(name, traceId, data) {
    const buffer = Buffer.from(JSON.stringify(data));

    if (buffer.length <= 1000) {
      await this._write(
        name,
        traceId,
        ["is-start", "is-end", "is-encoding-json"],
        buffer
      );

      return;
    }

    for (let i = 0; i < buffer.length; i += 1000) {
      const extras = ["is-encoding-json"];

      if (i === 0) {
        extras.push("is-start");
      }

      if (i + 1000 >= buffer.length) {
        extras.push("is-end");
      }

      await this._write(name, traceId, extras, buffer.subarray(i, i + 1000));
    }
  }

  /**
   *
   * @param {string} name
   * @param {string} traceId
   * @param {Array<'is-start' | 'is-end' | 'is-encoding-json' | 'is-encoding-binary'>} extras
   * @param {Buffer} data
   * @returns {Promise<null>}
   */
  _write(name, traceId, extras, data) {
    return new Promise((resolve, reject) => {
      const firstLine = this.stringifyFirstLine(
        name,
        this.runnerId,
        traceId,
        extras
      );

      const buffer = Buffer.concat([Buffer.from(`${firstLine}\n`), data]);

      this.socket.write(buffer, (err) => {
        if (err) {
          return reject(err);
        }

        return resolve(null);
      });
    });
  }

  /**
   * @param {string} line
   * @returns {{
   *  name: string,
   *  traceId: string,
   *  encoding: 'json' | 'binary' | 'unknown'
   *  isStart: boolean;
   *  isEnd: boolean;
   * }}
   */
  parseFirstLine(line) {
    const split = line.trimEnd().split("::");

    let encoding = "unknown";

    if (split.includes("is-encoding-json", 2)) {
      encoding = "json";
    }

    if (split.includes("is-encoding-binary", 2)) {
      encoding = "binary";
    }

    const isStart = split.includes("is-start", 2);
    const isEnd = split.includes("is-end", 2);

    return {
      name: split.at(0),
      traceId: split.at(1),
      encoding: encoding,
      isStart,
      isEnd,
    };
  }

  /**
   * @param {string} name
   * @param {string} runnerId
   * @param {string} traceId
   * @param {Array<'is-start' | 'is-end' | 'is-encoding-json' | 'is-encoding-binary'>} extras
   * @returns {string}
   */
  stringifyFirstLine(name, runnerId, traceId, extras) {
    return [name, runnerId, traceId, ...extras].join("::");
  }
}

const main = async () => {
  const jobRunnerIdentifier = getArgument("job-runner-identifier");
  const jobControllerHost = getArgument("job-controller-host");
  const jobControllerPort = Number(getArgument("job-controller-port"));

  const jobber = new JobberSocket(
    jobControllerHost,
    jobControllerPort,
    jobRunnerIdentifier
  );

  jobber.connect();

  const shutdownRoutine = async () => {
    console.log("[main/shutdownRoutine] Received shutdown signal");

    await jobber.onTransaction_Shutdown(randomBytes(16).toString("hex"), {});

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
