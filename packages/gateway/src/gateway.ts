import { awaitTruthy, LoopBase } from "@jobber/common";
import {
  Channel,
  createChannel,
  createClientFactory,
  Metadata,
  RawClient,
  ServerError,
  Status,
} from "nice-grpc";
import { Item as JobItem } from "@jobber/grpc/basics/job.js";
import { Item as ActionItem } from "@jobber/grpc/basics/action.js";
import { Item as TriggerItem } from "@jobber/grpc/basics/trigger.js";
import { Item as RunnerItem } from "@jobber/grpc/basics/runner.js";
import {
  EventHttpRequest,
  EventHttpRequest_Head,
  RunnerAPIDefinition,
} from "@jobber/grpc/runner.js";
import { FromTsProtoServiceDefinition } from "nice-grpc/lib/service-definitions/ts-proto.js";
import { IncomingMessage, Server, ServerResponse } from "node:http";
import {
  getOAuthAudienceGeneralApi,
  getOAuthAudienceRunnerApi,
} from "@jobber/common/oauth.js";
import { randomUUID } from "node:crypto";
import { getConfigOption } from "./config.js";
import { GeneralAPIDefinition } from "@jobber/grpc/general.js";
import assert from "node:assert";
import { createOauth2Token } from "./oauth-client.js";
import { ConnectivityState } from "@grpc/grpc-js/build/src/connectivity-state.js";

type RunnerClient = RawClient<
  FromTsProtoServiceDefinition<RunnerAPIDefinition>
>;

type GeneralClient = RawClient<
  FromTsProtoServiceDefinition<GeneralAPIDefinition>
>;

type GrpcAuth = {
  audience: string;
  jwt: string;
  expiresAt: number;
  refreshAt: number;
  metadata: Metadata;
};

type JobEntry = {
  job: JobItem;
  action: ActionItem;
  triggers: TriggerItem[];
  runners: RunnerItem[];
};

type RunnerConnection = {
  jobId: string;
  auth: GrpcAuth;
  channel: Channel;
  client: RunnerClient;
};

export class GatewayClient extends LoopBase {
  protected loopDuration = 500;

  protected loopStarted = undefined;
  protected loopClosed = undefined;

  private server: Server | null = null;

  private grpcAuth: GrpcAuth | null = null;
  private grpcChannel: Channel | null = null;
  private grpcClient: GeneralClient | null = null;

  /** Key: job.id */
  private jobs = new Map<string, JobEntry>();

  /** Key: runner.id */
  private runnerGrpc = new Map<string, RunnerConnection>();

  /** Key: trigger.id */
  private triggers = new Map<string, TriggerItem>();

  constructor() {
    super();
  }

  private static createAuth(
    audience: string,
    tokenResult: { token: string; expiresAt: number; refreshAt: number },
  ): GrpcAuth {
    return {
      audience,
      jwt: tokenResult.token,
      expiresAt: tokenResult.expiresAt,
      refreshAt: tokenResult.refreshAt,
      metadata: Metadata({
        Authorization: `Bearer ${tokenResult.token}`,
      }),
    };
  }

  private async refreshAuthIfNeeded(auth: GrpcAuth): Promise<boolean> {
    if (Date.now() / 1000 < auth.refreshAt) {
      return false;
    }

    console.log(
      `[Gateway] Refreshing OAuth2 token for audience: ${auth.audience}`,
    );
    const tokenResult = await createOauth2Token(auth.audience);

    auth.jwt = tokenResult.token;
    auth.expiresAt = tokenResult.expiresAt;
    auth.refreshAt = tokenResult.refreshAt;
    auth.metadata.set("Authorization", `Bearer ${tokenResult.token}`);

    return true;
  }

  private async refreshRunnerTokens() {
    for (const connection of this.runnerGrpc.values()) {
      await this.refreshAuthIfNeeded(connection.auth);
    }
  }

  protected async loopStarting() {
    const audience = getOAuthAudienceGeneralApi();
    const tokenResult = await createOauth2Token(audience);

    this.grpcAuth = GatewayClient.createAuth(audience, tokenResult);

    this.grpcChannel = createChannel(getConfigOption("GRPC_ENDPOINT"));
    this.grpcClient = createClientFactory().create(
      GeneralAPIDefinition,
      this.grpcChannel,
      { "*": { metadata: this.grpcAuth.metadata } },
    );

    // Force a loop iteration to ensure routes are ready
    await this.loopIteration();

    this.server = new Server();
    this.server.listen(getConfigOption("PORT"));
    this.server.on("request", (req, res) => this.handleHttpRequest(req, res));
  }

  protected async loopClosing() {
    await new Promise((resolve, reject) =>
      this.server?.close((err) => (err ? reject(err) : resolve(true))),
    );

    for (const connection of this.runnerGrpc.values()) {
      connection.channel.close();
    }
    this.runnerGrpc.clear();
    this.triggers.clear();
    this.jobs.clear();

    this.grpcChannel?.close();
    this.grpcChannel = null;
    this.grpcClient = null;
    this.grpcAuth = null;
  }

  protected async loopIteration() {
    assert(this.grpcClient);
    assert(this.grpcAuth);

    // Refresh tokens if they are approaching expiry
    await this.refreshAuthIfNeeded(this.grpcAuth);
    await this.refreshRunnerTokens();

    // Fetch enabled jobs
    const jobs = (await this.grpcClient.getJobs({})).jobs.filter(
      (job) => job.status === "ENABLED" && job.versionId,
    );

    // Remove jobs that no longer exist
    const activeJobIds = new Set(jobs.map((job) => job.id));

    for (const [id, data] of this.jobs) {
      if (!activeJobIds.has(id)) {
        this.handleJobRemoval(data.job);
      }
    }

    // Add or update existing jobs
    await Promise.all(jobs.map((job) => this.handleJobUpdate(job)));
  }

  private async handleJobUpdate(job: JobItem) {
    assert(this.grpcClient);

    // Fetch triggers, action, and runners in parallel
    const [{ triggers }, { action }, { runners }] = await Promise.all([
      this.grpcClient.getJobTriggersLatest({ jobId: job.id }),
      this.grpcClient.getJobActionLatest({ jobId: job.id }),
      this.grpcClient.getRunners({
        jobId: job.id,
        status: "READY",
        versionId: job.versionId,
      }),
    ]);

    if (!action) {
      console.log(`[Gateway] Job ${job.id} has no action, skipping`);
      return;
    }

    const readyRunners = runners.filter((runner) => runner.readyAt !== null);
    const previous = this.jobs.get(job.id);

    // Clean up gRPC connections for runners that are no longer active
    const activeRunnerIds = new Set(readyRunners.map((r) => r.id));

    for (const [runnerId, connection] of this.runnerGrpc) {
      if (connection.jobId === job.id && !activeRunnerIds.has(runnerId)) {
        connection.channel.close();
        this.runnerGrpc.delete(runnerId);
      }
    }

    // Create gRPC connections for new runners
    for (const runner of readyRunners) {
      if (this.runnerGrpc.has(runner.id)) {
        continue;
      }

      const audience = getOAuthAudienceRunnerApi(runner.id);
      const tokenResult = await createOauth2Token(audience);
      const auth = GatewayClient.createAuth(audience, tokenResult);

      const channel = createChannel(
        `http://${"127.0.0.1"}:${runner.properties?.runnerApiPort}`,
        undefined,
        {
          "grpc.keepalive_permit_without_calls": 1,
          "grpc.keepalive_timeout_ms": 30_000,
        },
      );

      const client = createClientFactory().create(
        RunnerAPIDefinition,
        channel,
        { "*": { metadata: auth.metadata } },
      );

      this.runnerGrpc.set(runner.id, { jobId: job.id, auth, channel, client });
    }

    // Remove triggers that no longer exist, then upsert current ones
    if (previous) {
      const currentTriggerIds = new Set(triggers.map((t) => t.id));

      for (const old of previous.triggers) {
        if (!currentTriggerIds.has(old.id)) {
          this.triggers.delete(old.id);
        }
      }
    }

    for (const trigger of triggers) {
      this.triggers.set(trigger.id, trigger);
    }

    this.jobs.set(job.id, { job, action, triggers, runners: readyRunners });
  }

  private handleJobRemoval(job: JobItem) {
    for (const [triggerId, trigger] of this.triggers) {
      if (trigger.jobId === job.id) {
        this.triggers.delete(triggerId);
      }
    }

    for (const [runnerId, connection] of this.runnerGrpc) {
      if (connection.jobId === job.id) {
        connection.channel.close();
        this.runnerGrpc.delete(runnerId);
      }
    }

    this.jobs.delete(job.id);
  }

  private async getRunner(entry: JobEntry) {
    assert(this.grpcClient);

    let method: "soft-create" | "recycle";

    if (entry.action.runnerMode === "RUN_ONCE") {
      method = "soft-create";
    } else if (entry.runners.length === 0) {
      method = "soft-create";
    } else {
      method = "recycle";
    }

    if (method === "recycle") {
      const runner =
        entry.runners[Math.floor(Math.random() * entry.runners.length)];

      const grpc = this.runnerGrpc.get(runner.id);
      if (grpc) {
        const state = grpc.channel.getConnectivityState(true);

        if (state === ConnectivityState.READY) {
          return runner;
        }
      }

      // This branch is reached when the runner has no valid gRPC channel. This can happen when the runner shuts-down, and the gateway has not yet updated its runners index.
      method = "soft-create";
    }

    if (method === "soft-create") {
      try {
        const { runner } = await this.grpcClient.createSoftRunner({
          jobId: entry.job.id,
          actionId: entry.action.id,
          versionId: entry.job.versionId,
        });

        if (!runner) {
          return null;
        }

        await awaitTruthy(async () => {
          const grpc = this.runnerGrpc.get(runner.id);
          if (!grpc) {
            return false;
          }

          const state = grpc.channel.getConnectivityState(true);
          return state === ConnectivityState.READY;
        }, 30_000);

        return runner;
      } catch (err) {
        if (err instanceof ServerError) {
          console.warn(
            `[Gateway] Failed to create RUN_ONCE runner for job ${entry.job.id}: ${err.message}`,
          );

          return null;
        }

        throw err;
      }
    }

    throw new Error(`Unsupported runner mode: ${entry.action.runnerMode}`);
  }

  private async handleHttpRequest(req: IncomingMessage, res: ServerResponse) {
    if (this.status !== "started") {
      res.statusCode = 503;
      res.end(
        this.status === "stopping"
          ? "Service Unavailable - Gateway stopping"
          : "Service Unavailable - Gateway not started",
      );
      return;
    }

    const trigger = this.matchTrigger(req);

    if (!trigger?.http || !this.jobs.has(trigger.jobId)) {
      res.statusCode = 502;
      res.end("Bad Gateway");
      return;
    }

    const entry = this.jobs.get(trigger.jobId)!;

    const runner = await this.getRunner(entry);

    if (!runner) {
      res.statusCode = 502;
      res.end("Bad Gateway - No runner available");
      return;
    }

    const connection = this.runnerGrpc.get(runner.id);
    if (!connection) {
      res.statusCode = 502;
      res.end("Bad Gateway - Runner connection not found");
      return;
    }

    try {
      const response = connection.client.eventHttp(
        this.buildHttpRequestStream(req, trigger),
      );

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
    } catch (err) {
      console.error(
        `[Gateway] Error proxying request to runner ${runner.id}:`,
        err,
      );

      if (!res.headersSent) {
        res.statusCode = 502;
        res.end("Bad Gateway - Runner error");
      } else if (!res.writableEnded) {
        res.end();
      }
    }
  }

  private async *buildHttpRequestStream(
    req: IncomingMessage,
    trigger: TriggerItem,
  ): AsyncIterable<EventHttpRequest> {
    const headers: EventHttpRequest_Head["headers"] = [];

    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) {
        for (const v of value) {
          headers.push({ name: key, value: v });
        }
      } else if (value !== undefined) {
        headers.push({ name: key, value });
      }
    }

    let path = "";
    let query = "";

    if (req.url) {
      const qPos = req.url.indexOf("?");
      if (qPos >= 0) {
        path = req.url.substring(0, qPos);
        query = req.url.substring(qPos + 1);
      } else {
        path = req.url;
      }
    }

    yield { info: { triggerName: trigger.http!.name ?? "" } };

    yield {
      head: {
        id: randomUUID(),
        scheme: "http",
        method: req.method || "GET",
        hostname: req.headers["host"] || "",
        headers,
        query,
        path,
      },
    };

    let seq = 0;

    for await (const chunk of req) {
      yield {
        body: { id: randomUUID(), seq: seq++, data: chunk, end: false },
      };
    }

    yield {
      body: {
        id: randomUUID(),
        seq: seq++,
        data: new Uint8Array(0),
        end: true,
      },
    };
  }

  private matchTrigger(req: IncomingMessage): TriggerItem | null {
    const host = req.headers["host"];
    const method = req.method;

    if (!host || !method || !req.url) {
      return null;
    }

    const qPos = req.url.indexOf("?");
    const path = qPos >= 0 ? req.url.substring(0, qPos) : req.url;

    for (const trigger of this.triggers.values()) {
      if (!trigger.http) {
        continue;
      }

      if (trigger.http.hostname && trigger.http.hostname !== host) {
        continue;
      }

      if (trigger.http.method && trigger.http.method !== method) {
        continue;
      }

      if (trigger.http.path) {
        if (trigger.http.path.startsWith("^")) {
          const regex = new RegExp(trigger.http.path);
          if (!regex.test(path)) {
            continue;
          }
        } else if (trigger.http.path !== path) {
          continue;
        }
      }

      return trigger;
    }

    return null;
  }
}
