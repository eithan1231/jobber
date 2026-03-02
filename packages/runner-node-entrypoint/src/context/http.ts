import { deferred } from "@jobber/common/deferred.js";
import { EventHttpRequest, EventHttpResponse } from "@jobber/grpc/runner.js";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { PassThrough, Readable, Writable } from "node:stream";
import { Runner } from "~/runner.js";

class HttpContextRequest {
  private eventBasicContext: EventHttpRequest["info"];
  private eventHttpHead: EventHttpRequest["head"];
  private stream = new PassThrough();
  private startStreamData = deferred<void>();

  private streamEventsStarted = false;

  private _receivedHeadersPromise = deferred<void>();

  constructor(
    private runner: Runner,
    private requestEvents: AsyncIterable<EventHttpRequest>,
  ) {}

  public async _startStreamingEvents() {
    if (this.streamEventsStarted) {
      throw new Error(
        `[HttpContextRequest/streamEvents] streamEvents can only be called once`,
      );
    }
    this.streamEventsStarted = true;

    let index = 0; // 0 = info, 1 = head, 2+ = body

    for await (const event of this.requestEvents) {
      if (index === 0) {
        if (!event.info) {
          throw new Error(
            `[HttpContextRequest/streamEvents] First event must be an info event`,
          );
        }

        this.eventBasicContext = event.info;
      }

      if (index === 1) {
        if (!event.head) {
          throw new Error(
            `[HttpContextRequest/streamEvents] Second event must be an head event`,
          );
        }

        this.eventHttpHead = event.head;

        this._receivedHeadersPromise.resolve();
      }

      if (index >= 2) {
        // Do not start streaming body until it has been requested
        await this.startStreamData.promise;

        if (!event.body) {
          throw new Error(
            `[HttpContextRequest/streamEvents] Body events must have a body`,
          );
        }

        if (event.body.seq !== index - 2) {
          throw new Error(
            `[HttpContextRequest/streamEvents] Body event sequence mismatch. Expected ${index - 2} but got ${event.body.seq}`,
          );
        }

        const writeResult = this.stream.write(event.body.data);

        if (!writeResult) {
          await once(this.stream, "drain");
        }

        if (event.body.end) {
          const finishedPromise = once(this.stream, "finish");

          this.stream.end();

          await finishedPromise;

          break;
        }
      }

      index++;
    }
  }

  public get receivedHeadersPromise() {
    return this._receivedHeadersPromise.promise;
  }

  public get name() {
    if (!this.eventBasicContext) {
      throw new Error("[HttpContextRequest/name] No info event received");
    }

    return this.eventBasicContext.triggerName;
  }

  public header(name: string) {
    if (!this.eventHttpHead) {
      throw new Error("[HttpContextRequest/header] No head event received");
    }

    const headers = this.eventHttpHead.headers.filter(
      (h) => h.name.toLowerCase() !== name.toLowerCase(),
    );

    if (headers.length === 0) {
      return undefined;
    }

    if (headers.length === 1) {
      return headers[0].value;
    }

    if (headers.length >= 2) {
      return headers.map((header) => header.value);
    }
  }

  public getHeaders(): { name: string; value: string }[] {
    if (!this.eventHttpHead) {
      throw new Error("[HttpContextRequest/getHeaders] No head event received");
    }

    return this.eventHttpHead.headers;
  }

  public query(name: string) {
    const values = this.getSearchParams().getAll(name);

    if (values.length === 0) {
      return null;
    }

    return values[0];
  }

  public queries(name: string) {
    const values = this.getSearchParams().getAll(name);

    if (values.length === 0) {
      return null;
    }

    return values;
  }

  public getSearchParams() {
    if (!this.eventHttpHead) {
      throw new Error(
        "[HttpContextRequest/getSearchParams] No head event received",
      );
    }

    return new URLSearchParams(this.eventHttpHead.query);
  }

  public get path() {
    if (!this.eventHttpHead) {
      throw new Error("[HttpContextRequest/path] No head event received");
    }

    return this.eventHttpHead.path;
  }

  public get method() {
    if (!this.eventHttpHead) {
      throw new Error("[HttpContextRequest/method] No head event received");
    }

    return this.eventHttpHead.method;
  }

  public getReadStream(): Readable {
    this.startStreamData.resolve();

    return this.stream;
  }

  public async json() {
    this.startStreamData.resolve();

    let body = "";

    for await (const chunk of this.stream) {
      body += chunk.toString();
    }

    return JSON.parse(body);
  }

  public async text() {
    this.startStreamData.resolve();

    let body = "";

    for await (const chunk of this.stream) {
      body += chunk.toString();
    }

    return JSON.parse(body);
  }

  /**
   * @deprecated use getReadStream, this is solely for backwards compatibility.
   */
  public async raw() {
    this.startStreamData.resolve();

    const buffers = [];

    for await (const chunk of this.stream) {
      buffers.push(chunk);
    }

    return Buffer.concat(buffers);
  }
}

class HttpContextResponse {
  private headers = new Headers();
  private statusCode = 200;
  private stream = new PassThrough();
  private headersFlushed = false;
  private flushHeadersPromise = deferred<void>();

  constructor(private runner: Runner) {}

  public header(name: string, value: string) {
    if (this.headersFlushed) {
      throw new Error(
        "[HttpContextResponse/header] Cannot set header after headers have been flushed",
      );
    }

    this.headers.set(name, value);
  }

  public status(statusCode: number) {
    if (this.headersFlushed) {
      throw new Error(
        "[HttpContextResponse/status] Cannot set status after headers have been flushed",
      );
    }

    this.statusCode = statusCode;
  }

  public getWriteStream(): Writable {
    this.headersFlushed = true;
    this.flushHeadersPromise.resolve();

    return this.stream;
  }

  public json<T = unknown>(data: T) {
    this.headersFlushed = true;
    this.flushHeadersPromise.resolve();

    this.header("Content-Type", "application/json");
    this.stream.write(JSON.stringify(data));
    this.stream.end();
  }

  public text(data: string) {
    this.headersFlushed = true;
    this.flushHeadersPromise.resolve();

    this.header("Content-Type", "text/plain");
    this.stream.write(data);
    this.stream.end();
  }

  public html(data: string) {
    this.headersFlushed = true;
    this.flushHeadersPromise.resolve();

    this.header("Content-Type", "text/html");
    this.stream.write(data);
    this.stream.end();
  }

  public async *createResponse(): AsyncGenerator<EventHttpResponse> {
    await this.flushHeadersPromise.promise;

    const baseId = randomUUID();

    await this.flushHeadersPromise.promise;

    yield {
      head: {
        headers: Array.from(this.headers.entries()).map(([name, value]) => ({
          name,
          value,
        })),
        id: `${baseId}`,
        status: this.statusCode,
      },
    };

    let seq = 0;
    for await (const chunk of this.stream) {
      yield {
        body: {
          id: `${baseId}-${seq}`,
          data: chunk,
          seq: seq,
          end: false,
        },
      };

      seq++;
    }

    yield {
      body: {
        id: `${baseId}-${seq}`,
        data: Buffer.alloc(0),
        seq: seq,
        end: true,
      },
    };
  }
}

export class HttpContext {
  private contextRequest: HttpContextRequest;

  private contextResponse: HttpContextResponse;

  constructor(runner: Runner, requestEvents: AsyncIterable<EventHttpRequest>) {
    this.contextRequest = new HttpContextRequest(runner, requestEvents);
    this.contextResponse = new HttpContextResponse(runner);
  }

  public get name() {
    return this.contextRequest.name;
  }

  public get request() {
    return this.contextRequest;
  }

  public get response() {
    return this.contextResponse;
  }

  public async *createResponse(): AsyncGenerator<EventHttpResponse> {
    yield* this.contextResponse.createResponse();
  }
}
