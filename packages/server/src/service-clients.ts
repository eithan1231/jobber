import { LoopBase } from "@jobber/common";
import { singleton } from "tsyringe";
import {
  OauthServiceClientTableInsertType,
  OauthServiceClientTableType,
} from "./db/schema/oauth-service-client.js";
import { secureRandomBytes } from "./util.js";
import { genSalt as bcryptGenSalt, hash as bcryptHash } from "bcryptjs";
import { oauthServiceClientModel } from "./db/oauth-service-client.js";
import { JobsTableType } from "./db/schema/jobs.js";
import {
  canOAuthAccessAudience,
  getOAuthAudienceGeneralApi,
  getOAuthAudienceRunnerApi,
} from "@jobber/common/oauth.js";
import { oauthSigningKeyModel } from "./db/oauth-signing-key.js";
import { createPrivateKey } from "node:crypto";
import { getConfigOption } from "./config.js";
import { SignJWT } from "jose";
import assert from "node:assert";

const CLIENT_ID_SYSTEM_CODE = `system-client-core`;
const SYSTEM_RESERVED_CLIENT_IDS = [CLIENT_ID_SYSTEM_CODE];

@singleton()
export class OAuthServiceClients extends LoopBase {
  protected loopDuration = 60 * 1000; // 1 minute

  protected loopStarting = undefined;
  protected loopStarted = undefined;
  protected loopClosing = undefined;
  protected loopClosed = undefined;

  private cachedSystemClientForServer: {
    client: OauthServiceClientTableType;
    secret: string;
  } | null = null;

  protected async loopIteration() {
    // await this.validateSigningKeys();
  }

  public async upsertServiceClient(
    data: Pick<
      OauthServiceClientTableInsertType,
      | "name"
      | "description"
      | "allowedAudiences"
      | "allowedScopes"
      | "enabled"
      | "expiresAt"
      | "isSystemManaged"
      | "permissions"
    > & {
      clientId?: string;
    },
  ) {
    if (
      !data.isSystemManaged &&
      data.clientId &&
      SYSTEM_RESERVED_CLIENT_IDS.includes(data.clientId)
    ) {
      throw new Error(
        `Client ID ${data.clientId} is reserved for system use. Please choose a different client ID.`,
      );
    }

    const secretKey = secureRandomBytes(56);
    const secretKeyAscii = secretKey.toString("ascii");
    const secretKeyEncoded = secretKey.toString("base64");
    const secretKeyHashed = await bcryptHash(
      secretKeyAscii,
      await bcryptGenSalt(9),
    );

    const clientId =
      data.clientId ??
      secureRandomBytes(36)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

    const client = await oauthServiceClientModel.upsert({
      ...data,

      clientId,
      metadata: {
        type: "client_secret_basic",
        clientSecretHashed: secretKeyHashed,
      },
    });

    assert(client);

    return {
      client,
      secret: secretKeyEncoded,
    };
  }

  /**
   * Generates a system managed oauth token for runners to authenticate with dependencies
   */
  public async getSystemClientForRunner(job: JobsTableType) {
    const serviceClientRunner = await this.upsertServiceClient({
      name: `System Client for Runner ${job.jobName} (Runner -> Core)`,
      description: `OAuth Service Client managed by the system for job ${job.jobName}`,
      isSystemManaged: true,
      allowedAudiences: [getOAuthAudienceGeneralApi()],
      allowedScopes: [],
      permissions: [
        {
          // Allow runner to read job info for itself and other runners of the same job
          effect: "allow",
          resource: `job/${job.id}/runners`,
          actions: ["read"],
        },
        {
          // Allow runner to read/write to its own store
          effect: "allow",
          resource: `job/${job.id}/store`,
          actions: ["read", "write", "delete"],
        },
        {
          // Allow runner to read the current version (inclusive of archive file!)
          effect: "allow",
          resource: `job/${job.id}/versions/${job.jobVersionId}`,
          actions: ["read"],
        },
        {
          // Allow runner to publish to MQTT topics for its own job
          effect: "allow",
          resource: `special/job/${job.id}/publish-mqtt`,
          actions: ["write"],
        },
      ],
    });

    return serviceClientRunner;
  }

  /**
   * Generates a system managed oauth token which allows the main server to communicate with its dependencies (runners, gateway, etc.)
   */
  public async getSystemClientForServer() {
    if (!this.cachedSystemClientForServer) {
      // TODO: Not sure I like this at all, breaks a lot of compatiblity if we want to move to the server
      // running in parallel
      this.cachedSystemClientForServer = await this.upsertServiceClient({
        clientId: CLIENT_ID_SYSTEM_CODE,

        name: `System Client for Core (Core -> Runners, Gateway, etc.)`,
        description: `OAuth Service Client managed by the system for the core server to communicate with its dependencies`,
        isSystemManaged: true,
        allowedAudiences: [getOAuthAudienceRunnerApi("*")],
        allowedScopes: [],
        permissions: [
          {
            // Allow core to invoke HTTP events
            effect: "allow",
            resource: `special/job/*/invoke-http-event`,
            actions: ["write"],
          },
          {
            // Allow core to invoke MQTT events
            effect: "allow",
            resource: `special/job/*/invoke-mqtt-event`,
            actions: ["write"],
          },
          {
            // Allow core to invoke CRON events
            effect: "allow",
            resource: `special/job/*/invoke-schedule-event`,
            actions: ["write"],
          },
          {
            // Allow core to check runner status
            effect: "allow",
            resource: `special/job/*/runner-status`,
            actions: ["read"],
          },
        ],
      });
    }

    return this.cachedSystemClientForServer;
  }

  public async generateTokenForServer(audience: string) {
    const serviceClientCore = await this.getSystemClientForServer();

    assert(serviceClientCore.client);

    const tokenResult = await this.generateToken(
      serviceClientCore.client,
      audience,
    );

    return tokenResult;
  }

  /**
   * Generates a token
   */
  public async generateToken(
    serviceClient: OauthServiceClientTableType,
    audience?: string,
  ) {
    // Set expiration to 10 minutes from now, or if the client is expiring within 10 minutes, set it to that expiration.
    let expiration = new Date(Date.now() + 10 * 60 * 1000);
    if (serviceClient.expiresAt && serviceClient.expiresAt < expiration) {
      expiration = serviceClient.expiresAt;
    }

    let jti = `${serviceClient.id}-${Date.now()}`;

    const validKey = await oauthSigningKeyModel.getValidKey();

    if (!validKey) {
      console.error(
        `[OAuthTokenRoute] No valid signing key found when trying to issue token for client ${serviceClient.id}`,
      );

      throw new Error("No valid signing key found");
    }

    const key = createPrivateKey({
      key: validKey.privateKeyEncrypted,
      format: "pem",
      passphrase: getConfigOption("SECRET_PASSPHRASE"),
    });

    const audiences: string[] = [];

    if (audience) {
      if (canOAuthAccessAudience(audience, serviceClient.allowedAudiences)) {
        audiences.push(audience);
      } else {
        throw new Error("Invalid audience");
      }
    } else {
      audiences.push(...serviceClient.allowedAudiences);
    }

    const jwt = await new SignJWT({
      sub: serviceClient.id,
      kid: validKey.id,
      permissions: serviceClient.permissions,
      typ: "JWT",
    })
      .setProtectedHeader({
        alg: validKey.alg,
        kid: validKey.id,
      })
      .setIssuer(getConfigOption("OAUTH_ISSUER"))
      .setAudience(audiences)
      .setExpirationTime(expiration)
      .setJti(jti)
      .sign(key);

    return {
      jwt,
      expiration,
    };
  }
}
