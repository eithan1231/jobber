import { LoopBase } from "@jobber/common";
import { singleton } from "tsyringe";
import { OauthServiceClientTableInsertType } from "./db/schema/oauth-service-client.js";
import { secureRandomBytes } from "./util.js";
import { genSalt as bcryptGenSalt, hash as bcryptHash } from "bcryptjs";
import { oauthServiceClientModel } from "./db/oauth-service-client.js";

@singleton()
export class OAuthServiceClients extends LoopBase {
  protected loopDuration = 60 * 1000; // 1 minute

  protected loopStarting = undefined;
  protected loopStarted = undefined;
  protected loopClosing = undefined;
  protected loopClosed = undefined;

  protected async loopIteration() {
    // await this.validateSigningKeys();
  }

  public async createServiceClient(
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
    >,
  ) {
    const secretKey = secureRandomBytes(56);
    const secretKeyAscii = secretKey.toString("ascii");
    const secretKeyEncoded = secretKey.toString("base64");
    const secretKeyHashed = await bcryptHash(
      secretKeyAscii,
      await bcryptGenSalt(16),
    );

    const clientId = secureRandomBytes(36)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    //

    const client = await oauthServiceClientModel.create({
      ...data,

      clientId,
      metadata: {
        type: "client_secret_basic",
        clientSecretHashed: secretKeyHashed,
      },
    });

    return {
      client,
      secret: secretKeyEncoded,
    };
  }

  public getAudienceGeneralApi() {
    return `jobber-api`;
  }

  public getAudienceRunnerApi(runnerId: string) {
    return `jobber-runner:${runnerId}`;
  }

  public getAudienceGatewayApi() {
    return `jobber-gateway`;
  }
}
