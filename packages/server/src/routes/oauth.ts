import { canOAuthAccessAudience } from "@jobber/common/oauth.js";
import bcrypt from "bcryptjs";
import { Hono } from "hono";
import { SignJWT } from "jose";
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
import { OAuthServiceClients } from "~/service-clients.js";
import { OAuthSigningKeys } from "~/signing-keys.js";
import { createBenchmark } from "~/util.js";

export async function createRouteOAuth() {
  const rateLimit = container.resolve(RateLimit);
  const oauthSigningKeys = container.resolve(OAuthSigningKeys);
  const serviceClients = container.resolve(OAuthServiceClients);

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
    return c.json(await oauthSigningKeys.createJwksSet());
  });

  app.post("/oauth/token", createMiddlewareResponseTime(2000), async (c) => {
    const schema = z.object({
      grant_type: z.literal("client_credentials"),
      client_id: z.string(),
      client_secret: z.string(),
      audience: z.string().optional(),
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

    const clientSecretDecoded = Buffer.from(
      body.client_secret,
      "base64",
    ).toString("ascii");

    const isSecretValid = await bcrypt.compare(
      clientSecretDecoded,
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

    const tokenResult = await serviceClients.generateToken(
      serviceClient,
      body.audience,
    );

    return c.json({
      access_token: tokenResult.jwt,
      token_type: "Bearer",
      expires_in: Math.floor(
        (tokenResult.expiration.getTime() - Date.now()) / 1000,
      ),
    });
  });

  return app;
}
