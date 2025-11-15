import assert from "assert";
import { JobberHandlerRequest } from "./request.js";

export class JobberHandlerResponse {
  private _request: JobberHandlerRequest;
  public _status?: number;
  public _headers?: Record<string, string>;
  public _body?: Buffer[];

  // TODO: Remove this in a later revision, deprecated way of publishing MQTT events.
  public _publish?: Array<{ topic: string; body: Buffer }>;

  constructor(request: JobberHandlerRequest) {
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

  header(name: string, value: string) {
    if (this._request.type() !== "http") {
      throw new Error("Expecting request type of http");
    }

    assert(typeof name === "string");
    assert(typeof value === "string");
    assert(this._headers);

    this._headers[name.toLowerCase()] = value;

    return this;
  }

  status(status: number) {
    if (this._request.type() !== "http") {
      throw new Error("Expecting request type of http");
    }

    assert(typeof status === "number");

    this._status = status;

    return this;
  }

  redirect(path: string, status = 303) {
    if (this._request.type() !== "http") {
      throw new Error("Expecting request type of http");
    }

    assert(typeof path === "string");
    assert(typeof status === "number");
    assert(this._headers);

    this._headers["Location"] = path;

    this._status = status;

    return this;
  }

  json(data: any, status = 200) {
    if (this._request.type() !== "http") {
      throw new Error("Expecting request type of http");
    }

    assert(typeof status === "number");
    assert(this._body);

    this.header("Content-Type", "application/json");

    const removed = this._body.splice(0, this._body.length).length;
    if (removed > 0) {
      console.warn(
        `[JobberHandlerResponse] json() called, but body was not empty. Cleared ${removed} buffers.`
      );
    }

    this._body.push(Buffer.from(JSON.stringify(data)));

    this._status = status;

    return this;
  }

  text(data: string, status = 200) {
    if (this._request.type() !== "http") {
      throw new Error("Expecting request type of http");
    }

    assert(typeof data === "string");
    assert(typeof status === "number");
    assert(this._body);

    this.header("Content-Type", "text/plain");

    const removed = this._body.splice(0, this._body.length).length;
    if (removed > 0) {
      console.warn(
        `[JobberHandlerResponse] text() called, but body was not empty. Cleared ${removed} buffers.`
      );
    }

    this._body.push(Buffer.from(data));

    this._status = status;

    return this;
  }

  chunk(data: Buffer) {
    if (this._request.type() !== "http") {
      throw new Error("Expecting request type of http");
    }

    assert(data instanceof Buffer);
    assert(this._body);

    this._body.push(data);

    return this;
  }

  // TODO: Remove this in a later revision, deprecated way of publishing MQTT events.
  publish(topic: string, body: string | Buffer | any) {
    if (this._request.type() !== "mqtt") {
      throw new Error("Unable to publish to non-mqtt request");
    }

    assert(typeof topic === "string");
    assert(this._publish);

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
