import assert from "assert";
import { MqttContext } from "./mqtt.js";
import { ScheduleContext } from "./schedule.js";
import { HttpContext } from "./http.js";

export class LegacyContextRequest {
  constructor(private _request: MqttContext | HttpContext | ScheduleContext) {}

  private body?: Buffer;

  public async _externalProcess() {
    if (this._request instanceof HttpContext) {
      this.body = await this._request.request.raw();
    } else if (this._request instanceof MqttContext) {
      this.body = Buffer.from(this._request.payload);
    }
  }

  type() {
    if (this._request instanceof MqttContext) {
      return "mqtt";
    } else if (this._request instanceof HttpContext) {
      return "http";
    } else if (this._request instanceof ScheduleContext) {
      return "schedule";
    } else {
      throw new Error("Unknown request type");
    }
  }

  name() {
    if (this._request instanceof MqttContext) {
      return this._request.name;
    } else if (this._request instanceof HttpContext) {
      return this._request.name;
    } else if (this._request instanceof ScheduleContext) {
      return this._request.name;
    } else {
      throw new Error("Unknown request type");
    }
  }

  header(name: string) {
    if (this._request instanceof HttpContext) {
      return this._request.request.header(name);
    } else {
      throw new Error("Headers are only available for HTTP requests");
    }
  }

  query(name: string) {
    if (this._request instanceof HttpContext) {
      return this._request.request.query(name);
    } else {
      throw new Error("Query parameters are only available for HTTP requests");
    }
  }

  queries(name: string) {
    if (this._request instanceof HttpContext) {
      return this._request.request.queries(name);
    } else {
      throw new Error("Query parameters are only available for HTTP requests");
    }
  }

  method() {
    if (this._request instanceof HttpContext) {
      return this._request.request.method;
    } else {
      throw new Error("Method is only available for HTTP requests");
    }
  }

  path() {
    if (this._request instanceof HttpContext) {
      return this._request.request.path;
    } else {
      throw new Error("Path is only available for HTTP requests");
    }
  }

  topic() {
    if (this._request instanceof MqttContext) {
      return this._request.topic;
    } else {
      throw new Error("Topic is only available for MQTT requests");
    }
  }

  json<T = unknown>(): T {
    return JSON.parse(this.text());
  }

  text() {
    if (
      this._request instanceof HttpContext ||
      this._request instanceof MqttContext
    ) {
      if (!this.body) {
        throw new Error(
          "Body is not available. Ensure to call _streamBody() before accessing the body.",
        );
      }

      return this.body.toString();
    } else {
      throw new Error("Text body is only available for HTTP and MQTT requests");
    }
  }

  data() {
    if (
      this._request instanceof HttpContext ||
      this._request instanceof MqttContext
    ) {
      if (!this.body) {
        throw new Error(
          "Body is not available. Ensure to call _streamBody() before accessing the body.",
        );
      }

      return this.body;
    } else {
      throw new Error("Data body is only available for HTTP and MQTT requests");
    }
  }

  getHttpRequest(): Request {
    if (!(this._request instanceof HttpContext)) {
      throw new Error(
        "Only HTTP requests can be converted to a Request object",
      );
    }

    const urlScheme = "https";
    const urlHost = this.header("host") ?? "localhost";
    const urlPath = this._request.request.path;
    const urlQuery = this._request.request.getSearchParams();

    // This is cursed, but is what it is.
    const body =
      this._request.request.method === "GET" ||
      this._request.request.method === "HEAD"
        ? undefined
        : new Uint8Array(this.body ?? Buffer.alloc(0));

    const headers = new Headers();
    for (const { name, value } of this._request.request.getHeaders()) {
      headers.append(name, value);
    }

    return new Request(`${urlScheme}://${urlHost}${urlPath}?${urlQuery}`, {
      headers: headers,
      method: this.method(),
      body: body,
      redirect: "manual",
    });
  }
}
