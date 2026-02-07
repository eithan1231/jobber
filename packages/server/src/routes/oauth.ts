import bcrypt from "bcryptjs";
import { Hono } from "hono";
import { exportJWK, importSPKI, SignJWT } from "jose";
import { createPrivateKey } from "node:crypto";
import { container } from "tsyringe";
import { z } from "zod";
import { getConfigOption } from "~/config.js";
import { auditLogsModel } from "~/db/audit-log.js";
import { oauthServiceClientModel } from "~/db/oauth-service-client.js";
import { oauthSigningKeyModel } from "~/db/oauth-signing-key.js";
import { InternalHonoApp } from "~/index.js";
import { createMiddlewareResponseTime } from "~/middleware/response-time.js";
import { RateLimit } from "~/rate-limit.js";

export async function createRouteOAuth() {
  const rateLimit = container.resolve(RateLimit);

  const app = new Hono<InternalHonoApp>();

  app.get("/.well-known/openid-configuration", async (c) => {
    return c.json({
      issuer: getConfigOption("OAUTH_ISSUER"),
      token_endpoint: `${getConfigOption("API_URL")}/oauth/token`,
      jwks_uri: `${getConfigOption("API_URL")}/.well-known/jwks.json`,
      token_endpoint_auth_methods_supported: ["client_secret_basic"],
    });
  });

  app.get("/.well-known/jwks.json", async (c) => {
    const signedKeys = await oauthSigningKeyModel.getValidKeys();

    const keys = await Promise.all(
      signedKeys.map(async (key) => {
        const publicKeyObject = await importSPKI(key.publicKey, key.alg);

        const jwk = await exportJWK(publicKeyObject);

        jwk.kid = key.id;
        jwk.use = key.use;
        jwk.alg = key.alg;

        return jwk;
      }),
    );

    return c.json({
      keys: keys,
    });
  });

  app.post("/oauth/token", createMiddlewareResponseTime(2000), async (c) => {
    const schema = z.object({
      grant_type: z.literal("client_credentials"),
      client_id: z.string(),
      client_secret: z.string(),
    });

    const body = await schema.parseAsync(await c.req.parseBody(), {
      path: ["request", "body"],
    });

    const rateLimitKeys = {
      global: () => `oauth-token-global`,
      clientIdOk: (clientId: string) => `oauth-token-client-id-${clientId}`,
      clientIdFail: (clientId: string) => `oauth-token-client-id-${clientId}`,
      ip: (ip: string) => `oauth-token-ip-${ip.replace(/:/g, "-")}`,
    } as const;

    rateLimit.increment(rateLimitKeys.global());

    if (rateLimit.isRateLimited(rateLimitKeys.global(), 120)) {
      await auditLogsModel.createServiceClientLog(body.client_id, {
        type: "oauth-rate-limited",
        clientId: body.client_id,
        reason: "global",
      });

      return c.json({ error: "rate_limited" }, 429);
    }

    if (rateLimit.isRateLimited(rateLimitKeys.clientIdOk(body.client_id), 20)) {
      await auditLogsModel.createServiceClientLog(body.client_id, {
        type: "oauth-rate-limited",
        clientId: body.client_id,
        reason: "client-id",
      });

      return c.json({ error: "rate_limited" }, 429);
    }

    if (
      rateLimit.isRateLimited(rateLimitKeys.clientIdFail(body.client_id), 5)
    ) {
      await auditLogsModel.createServiceClientLog(body.client_id, {
        type: "oauth-rate-limited",
        clientId: body.client_id,
        reason: "client-id",
      });

      return c.json({ error: "rate_limited" }, 429);
    }

    const serviceClient = await oauthServiceClientModel.byClientId(
      body.client_id,
    );

    if (!serviceClient) {
      rateLimit.increment(rateLimitKeys.clientIdFail(body.client_id));

      await auditLogsModel.createServiceClientLog(body.client_id, {
        type: "oauth-invalid-client-id",
        clientId: body.client_id,
      });

      return c.json({ error: "invalid_client" }, 401);
    }

    if (!serviceClient.enabled) {
      rateLimit.increment(rateLimitKeys.clientIdFail(body.client_id));

      await auditLogsModel.createServiceClientLog(serviceClient.id, {
        type: "oauth-disabled-client",
        clientId: body.client_id,
      });

      return c.json({ error: "invalid_client" }, 401);
    }

    if (serviceClient.expiresAt && serviceClient.expiresAt < new Date()) {
      rateLimit.increment(rateLimitKeys.clientIdFail(body.client_id));

      await auditLogsModel.createServiceClientLog(serviceClient.id, {
        type: "oauth-expired-client",
        clientId: body.client_id,
      });

      return c.json({ error: "invalid_client" }, 401);
    }

    if (serviceClient.metadata.type !== "client_secret_basic") {
      rateLimit.increment(rateLimitKeys.clientIdFail(body.client_id));

      await auditLogsModel.createServiceClientLog(serviceClient.id, {
        type: "oauth-unsupported-grant-type",
        clientId: body.client_id,
        grantType: serviceClient.metadata.type,
      });

      return c.json({ error: "invalid_client" }, 401);
    }

    const isSecretValid = bcrypt.compare(
      body.client_secret,
      serviceClient.metadata.clientSecretHashed,
    );

    if (!isSecretValid) {
      rateLimit.increment(rateLimitKeys.clientIdFail(body.client_id));

      await auditLogsModel.createServiceClientLog(serviceClient.id, {
        type: "oauth-invalid-client-secret",
        clientId: body.client_id,
      });

      return c.json({ error: "invalid_client" }, 401);
    }

    rateLimit.increment(rateLimitKeys.clientIdOk(body.client_id));

    await auditLogsModel.createServiceClientLog(serviceClient.id, {
      type: "oauth-valid-client",
      clientId: body.client_id,
    });

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

      return c.json({ error: "server_error" }, 500);
    }

    const key = createPrivateKey({
      key: validKey.privateKeyEncrypted,
      format: "pem",
      passphrase: getConfigOption("SECRET_PASSPHRASE"),
    });

    const jwt = new SignJWT({
      sub: serviceClient.id,
      kid: validKey.id,
      typ: "JWT",
    })
      .setProtectedHeader({
        alg: validKey.alg,
        kid: validKey.id,
      })
      .setIssuer(getConfigOption("OAUTH_ISSUER"))
      .setAudience(serviceClient.allowedAudiences)
      .setExpirationTime(expiration)
      .setJti(jti)
      .sign(key);

    return c.json({
      access_token: jwt,
      token_type: "Bearer",
      expires_in: Math.floor((expiration.getTime() - Date.now()) / 1000),
    });
  });

  return app;
}
