import assert from "assert";
import { ScheduleContext } from "./schedule.js";
import { MqttContext } from "./mqtt.js";
import { HttpContext } from "./http.js";
import { once } from "events";

export class LegacyContextResponse {
  constructor(private _context: MqttContext | HttpContext | ScheduleContext) {}

  private _status?: number;
  private _headers?: Record<string, string>;
  private chunks = [] as Buffer[];
  private publishQueue = [] as Array<{ topic: string; body: Buffer }>;

  public async _externalProcess() {
    if (this._context instanceof HttpContext) {
      if (this._status) {
        this._context.response.status(this._status);
      }

      if (this._headers) {
        for (const [name, value] of Object.entries(this._headers)) {
          this._context.response.header(name, value);
        }
      }

      const writeStream = this._context.response.getWriteStream();
      for (const chunk of this.chunks) {
        writeStream.write(chunk);
      }
      writeStream.end();

      await once(writeStream, "finish");
    }

    if (this._context instanceof MqttContext) {
      for (const { topic, body } of this.publishQueue) {
        await this._context.publish(topic, body.toString());
      }
    }

    if (this._context instanceof ScheduleContext) {
      // No-op, Schedule responses are handled immediately in the json/text methods.
    }
  }

  header(name: string, value: string) {
    if (this._context instanceof HttpContext) {
      if (!this._headers) {
        this._headers = {};
      }

      this._headers[name.toLowerCase()] = value;

      return this;
    } else {
      throw new Error("Headers are only available for HTTP responses");
    }
  }

  status(status: number) {
    if (this._context instanceof HttpContext) {
      this._status = status;

      return this;
    } else {
      throw new Error("Status is only available for HTTP responses");
    }
  }

  redirect(path: string, status = 303) {
    if (this._context instanceof HttpContext) {
      this._status = status;
      this.header("Location", path);

      return this;
    } else {
      throw new Error("Redirect is only available for HTTP responses");
    }
  }

  json(data: any, status = 200) {
    if (this._context instanceof HttpContext) {
      if (this.chunks.length > 0) {
        this.chunks.splice(0, this.chunks.length);
      }

      this._status = status;
      this.header("Content-Type", "application/json");
      this.chunks.push(Buffer.from(JSON.stringify(data)));

      return this;
    } else {
      throw new Error("JSON responses are only available for HTTP responses");
    }
  }

  text(data: string, status = 200) {
    if (this._context instanceof HttpContext) {
      if (this.chunks.length > 0) {
        this.chunks.splice(0, this.chunks.length);
      }

      this._status = status;
      this.chunks.push(Buffer.from(data));

      return this;
    } else {
      throw new Error("Text responses are only available for HTTP responses");
    }
  }

  chunk(data: Buffer) {
    if (this._context instanceof HttpContext) {
      this.chunks.push(data);

      return this;
    } else {
      throw new Error(
        "Chunked responses are only available for HTTP responses",
      );
    }
  }

  // TODO: Remove this in a later revision, deprecated way of publishing MQTT events.
  publish(topic: string, body: string | Buffer | any) {
    if (this._context instanceof MqttContext) {
      const bodyBuffer =
        body instanceof Buffer
          ? body
          : typeof body === "string"
            ? Buffer.from(body)
            : Buffer.from(JSON.stringify(body));

      this.publishQueue.push({
        topic,
        body: bodyBuffer,
      });
    } else {
      throw new Error("Publish is only available for MQTT responses");
    }
  }
}
