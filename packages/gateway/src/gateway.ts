import { LoopBase } from "@jobber/common";
import {
  Channel,
  createChannel,
  createClientFactory,
  Metadata,
  RawClient,
} from "nice-grpc";
import { Item as JobItem } from "@jobber/grpc/basics/job.js";
import { Item as ActionItem } from "@jobber/grpc/basics/action.js";
import { Item as TriggerItem } from "@jobber/grpc/basics/trigger.js";
import { Item as RunnerItem } from "@jobber/grpc/basics/runner.js";
import {
  EventHttpRequest,
  EventHttpRequest_Head,
} from "@jobber/grpc/runner.js";
import { RunnerAPIDefinition } from "@jobber/grpc/runner.js";
import { FromTsProtoServiceDefinition } from "nice-grpc/lib/service-definitions/ts-proto.js";
import { IncomingMessage, Server } from "node:http";
import {
  getOAuthAudienceGeneralApi,
  getOAuthAudienceRunnerApi,
} from "@jobber/common/oauth.js";

import { randomUUID } from "node:crypto";
import { getConfigOption } from "./config.js";
import { GeneralAPIDefinition } from "@jobber/grpc/general.js";
import assert from "node:assert";
import { createOauth2Token } from "./oauth-client.js";

type RunnerClient = RawClient<
  FromTsProtoServiceDefinition<RunnerAPIDefinition>
>;

type GrpcAuth = {
  jwt: string;
  expiresAt: number;
  refreshAt: number;
  metadata: Metadata;
};

export class GatewayClient extends LoopBase {
  protected loopDuration = 1000;

  protected loopStarted = undefined;
  protected loopClosed = undefined;

  private server: Server | null = null;

  private grpcAuth: GrpcAuth | null = null;
  private grpcChannel: Channel | null = null;
  private grpcClient: RawClient<
    FromTsProtoServiceDefinition<GeneralAPIDefinition>
  > | null = null;

  // Key: job.id
  private jobs = new Map<
    string,
    {
      job: JobItem;
      action: ActionItem;
      triggers: TriggerItem[];
      runners: RunnerItem[];
    }
  >();

  // Key: runner.id
  private runnerGrpc = new Map<
    string,
    {
      jobId: string;
      auth: GrpcAuth;
      channel: Channel;
      client: RunnerClient;
    }
  >();

  // Key: trigger.id
  private triggers = new Map<string, TriggerItem>();

  constructor() {
    super();
  }

  protected async loopStarting() {
    const tokenResult = await createOauth2Token(getOAuthAudienceGeneralApi());

    this.grpcAuth = {
      jwt: tokenResult.token,
      expiresAt: tokenResult.expiresAt,
      refreshAt: tokenResult.refreshAt,
      metadata: Metadata({
        Authorization: `Bearer ${tokenResult.token}`,
      }),
    };

    this.grpcChannel = createChannel(getConfigOption("GRPC_ENDPOINT"));
    this.grpcClient = createClientFactory().create(
      GeneralAPIDefinition,
      this.grpcChannel,
      {
        "*": {
          metadata: this.grpcAuth.metadata,
        },
      },
    );

    this.server = new Server();

    this.server.listen(getConfigOption("PORT"));

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

      const route = this.getTriggerByRequest(req);

      if (!route || !route.http || !this.jobs.has(route.jobId)) {
        // handle bad gateway error
        res.statusCode = 502;
        res.end("Bad Gateway");
        return;
      }

      const { job, action, triggers, runners } = this.jobs.get(route.jobId)!;

      if (action.runnerMode === "RUN_ONCE") {
        throw new Error("RUN_ONCE not implemented yet");
      }

      let runner: RunnerItem;

      if (runners.length === 0) {
        // TODO: This, this will need to be done. Need to be able to start
        // runners on demand

        // runner = await this.grpcClient!.createRunner({
        //   jobId: job.id,
        //   versionId: job.versionId,
        // });
        // throw new Error("No runners available for job " + job.id);
        res.statusCode = 502;
        res.end("Bad Gateway - no runners available for job");
        return;
      } else {
        // select random runner
        const randomIndex = Math.floor(Math.random() * runners.length);
        runner = runners[randomIndex];
      }

      const runnerConnection = this.runnerGrpc.get(runner.id);
      if (!runnerConnection || !runnerConnection.client) {
        res.statusCode = 502;
        res.end("Bad Gateway - Runner connection not found");
        return;
      }

      const requestIterable =
        async function* (): AsyncIterable<EventHttpRequest> {
          let headers: EventHttpRequest_Head["headers"] = [];

          for (const [key, value] of Object.entries(req.headers)) {
            if (Array.isArray(value)) {
              for (const v of value) {
                headers.push({ name: key, value: v });
              }
            } else {
              headers.push({ name: key, value: value || "" });
            }
          }

          let path = "";
          let query = "";

          if (req.url) {
            const [rawPath, rawQuery] = req.url.split("?", 2);
            path = rawPath;
            query = rawQuery || "";
          }

          yield {
            info: {
              triggerName: route.http?.name!,
            },
          };

          yield {
            head: {
              id: randomUUID(),
              scheme: "http", // TODO: this
              method: req.method || "GET",
              hostname: req.headers["host"] || "",
              headers: headers,
              query: query,
              path: path,
            },
          };

          let dataSequence = 0;

          for await (const chunk of req) {
            yield {
              body: {
                id: randomUUID(),
                seq: dataSequence++,
                data: chunk,
                end: false,
              },
            };
          }

          yield {
            body: {
              id: randomUUID(),
              seq: dataSequence++,
              data: new Uint8Array(0),
              end: true,
            },
          };
        };

      const response = runnerConnection.client.eventHttp(requestIterable());

      for await (const event of response) {
        if (event.head) {
          res.statusCode = event.head.status;
          for (const header of event.head.headers) {
            res.setHeader(header.name, header.value);
          }
        }

        if (event.body) {
          res.write(event.body.data);
          if (event.body.end) {
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
      }),
    );

    await this.grpcChannel?.close();
    this.grpcChannel = null;
    this.grpcClient = null;
  }

  protected async loopIteration() {
    if (!this.grpcClient) {
      throw new Error("GrpcClient not started");
    }

    // TODO: Check if any tokens need refreshing.

    const jobs = await this.grpcClient
      .getJobs({})
      .then((res) =>
        res.jobs.filter((job) => job.status === "ENABLED" && job.versionId),
      );

    // Remove jobs that no longer exist

    for (const [id, data] of this.jobs) {
      if (!jobs.find((job) => job.id === id)) {
        await this.handleJobRemoval(data.job);
      }
    }

    // Add or update existing jobs
    await Promise.all(jobs.map(async (job) => this.handleJobUpdate(job)));
  }

  private async handleJobUpdate(job: JobItem) {
    assert(this.grpcClient);

    const { triggers } = await this.grpcClient.getJobTriggersLatest({
      jobId: job.id,
    });

    const { action } = await this.grpcClient.getJobActionLatest({
      jobId: job.id,
    });

    const { runners } = await this.grpcClient.getRunners({
      jobId: job.id,
      status: "READY",
      versionId: job.versionId,
    });

    if (!action) {
      console.log(`[Gateway] Job ${job.id} has no action, skipping`);
      return;
    }

    this.jobs.set(job.id, {
      job,
      action,
      triggers,
      runners: runners.filter((runner) => runner.readyAt !== null),
    });

    for (const runner of runners) {
      if (this.runnerGrpc.has(runner.id)) {
        continue;
      }

      const tokenResult = await createOauth2Token(
        getOAuthAudienceRunnerApi(runner.id),
      );

      const auth: GrpcAuth = {
        jwt: tokenResult.token,
        expiresAt: tokenResult.expiresAt,
        refreshAt: tokenResult.refreshAt,
        metadata: Metadata({
          Authorization: `Bearer ${tokenResult.token}`,
        }),
      };

      const channel = createChannel(
        // TODO: this
        `http://${"192.168.10.200"}:${runner.properties?.runnerApiPort}`,
      );
      const client = createClientFactory().create(
        RunnerAPIDefinition,
        channel,
        {
          "*": {
            metadata: auth.metadata,
          },
        },
      );

      this.runnerGrpc.set(runner.id, {
        jobId: job.id,
        auth,
        channel,
        client,
      });
    }

    for (const trigger of triggers) {
      this.triggers.set(trigger.id, trigger);
    }
  }

  private async handleJobRemoval(job: JobItem) {
    for (const [, trigger] of this.triggers) {
      if (trigger.jobId === job.id) {
        this.triggers.delete(trigger.id);
      }
    }

    for (const [runnerId, runner] of this.runnerGrpc) {
      if (runner.jobId !== job.id) {
        continue;
      }

      runner.channel.close();
      this.runnerGrpc.delete(runnerId);
    }

    this.jobs.delete(job.id);
  }

  private getTriggerByRequest(req: IncomingMessage) {
    // TODO: This is slow as shit.
    const host = req.headers["host"];
    const method = req.method;
    const path = req.url;

    if (!host || !method || !path) {
      return null;
    }

    for (const route of this.triggers.values()) {
      if (!route.http) {
        continue;
      }

      if (route.http.hostname && route.http.hostname !== host) {
        continue;
      }

      if (route.http.method && route.http.method !== method) {
        continue;
      }

      if (route.http.path) {
        if (route.http.path.startsWith("^")) {
          const regex = new RegExp(route.http.path);
          if (!regex.test(path)) {
            continue;
          }
        } else if (route.http.path && route.http.path !== path) {
          continue;
        }
      }

      return route;
    }

    return null;
  }
}
