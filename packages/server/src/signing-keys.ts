import { LoopBase } from "@jobber/common";
import { singleton } from "tsyringe";
import { oauthSigningKeyModel } from "./db/oauth-signing-key.js";
import { OauthSigningKeyTableInsertType } from "./db/schema/oauth-signing-key.js";
import { generateKeyPair } from "node:crypto";
import { promisify } from "node:util";
import { getConfigOption } from "./config.js";

const generateKeyPairPromised = promisify(generateKeyPair);

@singleton()
export class OAuthSigningKeys extends LoopBase {
  protected loopDuration = 60 * 1000; // 1 minute

  protected loopStarting = undefined;
  protected loopStarted = undefined;
  protected loopClosing = undefined;
  protected loopClosed = undefined;

  protected async loopIteration() {
    await this.validateSigningKeys();
  }

  public async validateSigningKeys() {
    const validKeys = await oauthSigningKeyModel.getValidKeys();

    if (validKeys.length === 0) {
      return await this.createSigningKey();
    }

    for (const key of validKeys) {
      // If the key has expired, mark it as inactive
      if (
        key.expiresAt &&
        new Date() > key.expiresAt &&
        key.status !== "inactive"
      ) {
        await oauthSigningKeyModel.update(key.id, { status: "inactive" });
      }

      // If the key needs to be rotated, create a new key and mark the old key as retiring
      if (
        key.renewsAt &&
        new Date() > key.renewsAt &&
        key.status === "active"
      ) {
        // create a new key with the current key as the parent
        const replacementKey = await this.createSigningKey({
          parentId: key.id,
          createdByUserId: key.createdByUserId,
        });

        if (!replacementKey) {
          console.warn(
            `[OAuthSigningKeys/validateSigningKeys] Failed to create replacement key for key ${key.id}`,
          );
          continue;
        }

        await oauthSigningKeyModel.update(key.id, {
          status: "retiring",
          childId: replacementKey.id,
        });
      }
    }
  }

  public async createSigningKey(
    data?: Partial<
      Pick<
        OauthSigningKeyTableInsertType,
        | "createdByUserId"
        | "parentId"
        | "childId"
        | "use"
        | "alg"
        | "expiresAt"
        | "renewsAt"
      >
    >,
  ) {
    console.log(
      `[OAuthSigningKeys/createSigningKey] Creating new signing key with data: ${JSON.stringify(
        data,
      )}`,
    );

    const { privateKey, publicKey } = await generateKeyPairPromised("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: "spki",
        format: "pem",
      },
      privateKeyEncoding: {
        type: "pkcs8",
        format: "pem",
        cipher: "aes-256-cbc",
        passphrase: getConfigOption("SECRET_PASSPHRASE"),
      },
    });

    return await oauthSigningKeyModel.create({
      parentId: data?.parentId,
      createdByUserId: data?.createdByUserId,

      status: "active",

      alg: data?.alg ?? "RS256",
      use: data?.use ?? "sig",

      privateKeyEncrypted: privateKey,
      publicKey: publicKey,

      expiresAt:
        data?.expiresAt ??
        new Date(
          Date.now() +
            getConfigOption("OAUTH_SIGNING_KEY_EXPIRE_IN_DAYS") *
              60 *
              60 *
              24 *
              1000,
        ),

      renewsAt:
        data?.renewsAt ??
        new Date(
          Date.now() +
            getConfigOption("OAUTH_SIGNING_KEY_ROTATE_IN_DAYS") *
              60 *
              60 *
              24 *
              1000,
        ),
    });
  }
}
