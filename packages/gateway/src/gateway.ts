import { LoopBase } from "@jobber/common";
import {
  HttpEventRequest,
  HttpHeaders,
  RunnerDefinition,
} from "@jobber/grpc/runner.js";
import {
  Channel,
  createChannel,
  createClientFactory,
  RawClient,
} from "nice-grpc";
import { FromTsProtoServiceDefinition } from "nice-grpc/lib/service-definitions/ts-proto.js";
import { IncomingMessage, Server } from "node:http";
import { inject, singleton } from "tsyringe";
import { GrpcClient } from "./grpc-client.js";
import {
  ActionItem,
  JobItem,
  RunnerItem,
  TriggerHttpItem,
} from "@jobber/grpc/server.js";
import assert from "node:assert";
import { randomUUID } from "node:crypto";
import { getConfigOption } from "./config.js";

type RunnerClient = RawClient<FromTsProtoServiceDefinition<RunnerDefinition>>;

async function asyncIterablePromiseAll<T>(
  iterable: AsyncIterable<T>
): Promise<T[]> {
  const resolved: T[] = [];

  for await (const p of iterable) {
    resolved.push(p);
  }

  return resolved;
}

@singleton()
export class GatewayClient extends LoopBase {
  protected loopDuration = 1000;

  protected loopStarted = undefined;
  protected loopClosed = undefined;

  private server: Server | null = null;

  private routes = new Map<
    string,
    {
      hostname?: string;
      method?: string;
      path?: string;

      job: JobItem;
      action: ActionItem;
      trigger: TriggerHttpItem;
      runners: RunnerItem[];
    }
  >();

  private runners = new Map<
    string,
    {
      runner: RunnerItem;
      channel: Channel;
      client: RunnerClient;
    }
  >();

  constructor(
    @inject(GrpcClient, { isOptional: false })
    private grpcClient: GrpcClient
  ) {
    super();
  }

  protected async loopStarting() {
    this.server = new Server();

    this.server.listen(getConfigOption("GATEWAY_PORT"));

    this.server.on("request", async (req, res) => {
      if (this.status === "neutral") {
        res.statusCode = 503;
        res.end("Service Unavailable - Gateway not started");
        return;
      }

      if (this.status === "stopping") {
        res.statusCode = 503;
        res.end("Service Unavailable - Gateway stopping");
        return;
      }

      const route = this.getRouteByRequest(req);

      if (!route) {
        // handle bad gateway error
        res.statusCode = 502;
        res.end("Bad Gateway");
        return;
      }

      if (route.action.runnerMode === "RUN_ONCE") {
        throw new Error("RUN_ONCE not implemented yet");
      }

      let runner: RunnerItem;

      if (route.runners.length === 0) {
        runner = await this.grpcClient.client.createRunner({
          jobId: route.job.id,
          versionId: route.job.versionId,
        });
      } else {
        // select random runner
        const randomIndex = Math.floor(Math.random() * route.runners.length);
        runner = route.runners[randomIndex];
      }

      const runnerConnection = this.runners.get(runner.id);
      if (!runnerConnection) {
        res.statusCode = 502;
        res.end("Bad Gateway - Runner connection not found");
        return;
      }

      const requestIterable =
        async function* (): AsyncIterable<HttpEventRequest> {
          let headers: HttpHeaders[] = [];

          for (const [key, value] of Object.entries(req.headers)) {
            if (Array.isArray(value)) {
              for (const v of value) {
                headers.push({ name: key, value: v });
              }
            } else {
              headers.push({ name: key, value: value || "" });
            }
          }

          yield {
            reqHead: {
              id: randomUUID(),
              scheme: "http", // TODO: this
              method: req.method || "GET",
              hostname: req.headers["host"] || "",
              headers: headers,
              path: req.url || "/",
            },
          };

          let dataSequence = 1;

          for await (const chunk of req) {
            yield {
              reqBody: {
                id: randomUUID(),
                seq: dataSequence++,
                data: chunk,
                end: false,
              },
            };
          }

          yield {
            reqBody: {
              id: randomUUID(),
              seq: dataSequence++,
              data: new Uint8Array(0),
              end: true,
            },
          };
        };

      const response = runnerConnection.client.eventHttp(requestIterable());

      for await (const event of response) {
        if (event.resHead) {
          res.statusCode = event.resHead.status;
          for (const header of event.resHead.headers) {
            res.setHeader(header.name, header.value);
          }
        }

        if (event.resBody) {
          res.write(event.resBody.data);
          if (event.resBody.end) {
            res.end();
          }
        }
      }
    });
  }

  protected async loopClosing() {
    // Await for server to close.
    await new Promise((resolve, reject) =>
      this.server?.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve(true);
        }
      })
    );
  }

  protected async loopIteration() {
    const gatewayConfig = await this.grpcClient.client.getGatewayConfig({});

    for (const route of this.routes.values()) {
      const hasRoute = gatewayConfig.items.find((item) =>
        item.httpTriggers.find(
          (trigger) =>
            trigger.jobId === route.job.id && trigger.id === route.trigger.id
        )
      );

      if (!hasRoute) {
        this.routes.delete(route.action.id);

        for (const runner of route.runners) {
          const runnerInfo = this.runners.get(runner.id);

          if (!runnerInfo) {
            continue;
          }

          runnerInfo.channel.close();

          this.runners.delete(runner.id);
        }
      }
    }

    for (const item of gatewayConfig.items) {
      for (const runner of item.runners) {
        if (!this.runners.has(runner.id)) {
          const channel = createChannel(`${runner.ip}:${runner.port}`);

          const client = createClientFactory().create(
            RunnerDefinition,
            channel
          );

          this.runners.set(runner.id, {
            runner,
            channel,
            client,
          });
        }
      }

      for (const trigger of item.httpTriggers) {
        assert(item.job);
        assert(item.action);

        this.routes.set(trigger.id, {
          hostname: trigger.hostname,
          method: trigger.method,
          path: trigger.path,

          job: item.job,
          action: item.action,
          trigger: trigger,

          runners: item.runners,
        });
      }
    }
  }

  private getRouteByRequest(req: IncomingMessage) {
    const host = req.headers["host"];
    const method = req.method;
    const path = req.url;

    if (!host || !method || !path) {
      return null;
    }

    for (const route of this.routes.values()) {
      if (route.hostname && route.hostname !== host) {
        continue;
      }

      if (route.method && route.method !== method) {
        continue;
      }

      if (route.path) {
        if (route.path.startsWith("^")) {
          const regex = new RegExp(route.path);
          if (!regex.test(path)) {
            continue;
          }
        } else if (route.path && route.path !== path) {
          continue;
        }
      }

      return route;
    }

    return null;
  }
}
