import {
  GeneralAPIClient,
  GeneralAPIDefinition,
} from "@jobber/grpc/general.js";
import { Runner, RunnerOptions } from "./runner.js";
import {
  createClient,
  CallContext,
  createServer,
  ServerError,
  ServiceImplementation,
  Status,
  createChannel,
  ChannelCredentials,
  Metadata,
  Client,
} from "nice-grpc";
import { LoopBase } from "@jobber/common/loop-base.js";
import { getUnixTimestamp } from "./util.js";
import { ChannelImplementation } from "@grpc/grpc-js/build/src/channel.js";

type CachedToken = {
  accessToken: string;
  tokenType: string;
  expiresAt: number;
  renewsAt: number;
  originalTtl: number;
};

export class RunnerClient extends LoopBase {
  protected loopDuration = 60 * 1000;

  protected loopStarted = undefined;
  protected loopClosing = undefined;

  private cachedToken: CachedToken | null = null;
  private cachedMetadata = new Metadata();

  private channel: ChannelImplementation | null = null;
  private client: Client<GeneralAPIDefinition> | null = null;

  protected async loopIteration() {
    await this.checkClient();
  }

  constructor(
    private runner: Runner,
    private options: RunnerOptions,
  ) {
    super();
  }

  private async checkClient() {
    if (this.cachedToken && getUnixTimestamp() < this.cachedToken.expiresAt) {
      return;
    }

    try {
      if (this.options.runnerDebug) {
        console.log(`[RunnerClient/loopIteration] Fetching new OAuth token...`);
      }

      const token = await this.createAuth();

      this.cachedToken = {
        accessToken: token.accessToken,
        tokenType: token.tokenType,
        expiresAt: getUnixTimestamp() + token.expiresIn,
        renewsAt: getUnixTimestamp() + Math.floor(token.expiresIn * 0.6),
        originalTtl: token.expiresIn,
      };

      this.cachedMetadata.set(
        "Authorization",
        `${token.tokenType} ${token.accessToken}`,
      );

      if (this.options.runnerDebug) {
        console.log(
          `[RunnerClient/loopIteration] Obtained new OAuth token, expires in ${token.expiresIn} seconds.`,
        );
      }
    } catch (err) {
      console.error(
        `[RunnerClient/loopIteration] Failed to fetch OAuth token:`,
        err,
      );
    }
  }

  private async createAuth() {
    const response = await fetch(this.options.runnerOAuthTokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.options.runnerClientId,
        client_secret: this.options.runnerClientSecret,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch OAuth token: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();

    const accessToken = data.access_token as string;
    const tokenType = data.token_type as string;
    const expiresIn = data.expires_in as number;

    if (
      !accessToken ||
      !tokenType ||
      !expiresIn ||
      typeof accessToken !== "string" ||
      typeof tokenType !== "string" ||
      typeof expiresIn !== "number"
    ) {
      throw new Error(`Invalid OAuth token response: ${JSON.stringify(data)}`);
    }

    return {
      accessToken,
      tokenType,
      expiresIn,
    };
  }

  protected async loopStarting() {
    await this.checkClient();

    this.channel = createChannel(
      this.options.runnerGeneralApiEndpoint,
      ChannelCredentials.createInsecure(),
    );

    this.client = createClient(GeneralAPIDefinition, this.channel, {
      "*": {
        metadata: this.cachedMetadata,
      },
    });
  }

  protected async loopClosed() {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }

    this.client = null;

    this.cachedToken = null;

    this.cachedMetadata = new Metadata();
  }

  get methods() {
    if (!this.client) {
      throw new Error("[RunnerClient/methods] Client not initialized yet");
    }

    return this.client;
  }
}
