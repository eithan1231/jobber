import assert from "assert";

type JobberHandlerRequestData = {
  type: "http" | "schedule" | "mqtt";
  name?: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  queries: Record<string, string[]>;
  path: string;
  method: string;
  topic: string;
  body: string;
  bodyLength: number;
};

export class JobberHandlerRequest {
  private _type: JobberHandlerRequestData["type"];
  private _name: JobberHandlerRequestData["name"];
  private _headers: JobberHandlerRequestData["headers"] = {};
  private _query: JobberHandlerRequestData["query"] = {};
  private _queries: JobberHandlerRequestData["queries"] = {};
  private _path: JobberHandlerRequestData["path"] = "";
  private _method: JobberHandlerRequestData["method"] = "";
  private _topic: JobberHandlerRequestData["topic"] = "";
  private _body?: Buffer;
  private _bodyLength?: number;

  constructor(data: JobberHandlerRequestData) {
    this._type = data.type;
    this._name = data.name;

    if (this._type === "http") {
      this._headers = data.headers;
    }

    if (this._type === "http") {
      this._query = data.query;
    }

    if (this._type === "http") {
      this._queries = data.queries;
    }

    if (this._type === "http") {
      this._path = data.path;
    }

    if (this._type === "http") {
      this._method = data.method;
    }

    if (this._type === "mqtt") {
      this._topic = data.topic;
    }

    if (this._type === "http" || this._type == "mqtt") {
      this._body = data.body
        ? Buffer.from(data.body, "base64")
        : Buffer.alloc(0);
    }

    if (this._type === "http" || this._type == "mqtt") {
      this._bodyLength = data.bodyLength;
    }
  }

  type() {
    return this._type;
  }

  name() {
    return this._name ?? null;
  }

  header(name: string) {
    if (this._type !== "http") {
      throw new Error("[JobberHandlerRequest/header] Expecting type of http");
    }

    const key = name.toLowerCase();

    if (this._headers[key]) {
      return this._headers[key];
    }

    return null;
  }

  query(name: string) {
    if (this._type !== "http") {
      throw new Error("[JobberHandlerRequest/header] Expecting type of http");
    }

    const key = name.toLowerCase();

    if (this._query[key]) {
      return this._query[key];
    }

    return null;
  }

  queries(name: string) {
    if (this._type !== "http") {
      throw new Error("[JobberHandlerRequest/header] Expecting type of http");
    }

    const key = name.toLowerCase();

    if (this._queries[key]) {
      return this._queries[key];
    }

    return null;
  }

  method() {
    if (this._type !== "http") {
      throw new Error("[JobberHandlerRequest/header] Expecting type of http");
    }

    return this._method;
  }

  path() {
    if (this._type !== "http") {
      throw new Error("[JobberHandlerRequest/header] Expecting type of http");
    }

    return this._path;
  }

  topic() {
    if (this._type !== "mqtt") {
      throw new Error("[JobberHandlerRequest/header] Expecting type of mqtt");
    }

    return this._topic;
  }

  json<T = unknown>(): T {
    if (this._type !== "http" && this._type !== "mqtt") {
      throw new Error("[JobberHandlerRequest/header] Expecting type of http");
    }

    assert(this._body);

    return JSON.parse(this._body.toString()) as T;
  }

  text() {
    if (this._type !== "http" && this._type !== "mqtt") {
      throw new Error("[JobberHandlerRequest/header] Expecting type of http");
    }

    assert(this._body);

    return this._body.toString();
  }

  data() {
    if (this._type !== "http" && this._type !== "mqtt") {
      throw new Error("[JobberHandlerRequest/header] Expecting type of http");
    }

    return this._body;
  }

  getHttpRequest(): Request {
    if (this._type !== "http") {
      throw new Error(
        "[JobberHandlerRequest/getHttpRequest] Expecting type of http"
      );
    }

    const urlScheme = "https";
    const urlHost = this.header("host") ?? "localhost";
    const urlPath = this._path;
    const urlQuery = new URLSearchParams(this._query);
    const body =
      this._method === "GET" || this._method === "HEAD"
        ? undefined
        : this._body;

    return new Request(`${urlScheme}://${urlHost}${urlPath}?${urlQuery}`, {
      headers: this._headers,
      method: this._method,
      body: body,
      redirect: "manual",
    });
  }
}
