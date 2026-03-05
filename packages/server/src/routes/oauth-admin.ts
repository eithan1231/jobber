import { JobberPermissionsSchema } from "@jobber/common/permissions.js";
import { Hono } from "hono";
import { container } from "tsyringe";
import { z } from "zod";
import { oauthServiceClientModel } from "~/db/oauth-service-client.js";
import { oauthSigningKeyModel } from "~/db/oauth-signing-key.js";
import {
  OauthServiceClientTableType,
  OauthSigningKeyTableType,
} from "~/db/types.js";
import { InternalHonoApp } from "~/index.js";
import { createMiddlewareAuth } from "~/middleware/auth.js";
import { OAuthServiceClients } from "~/service-clients.js";
import { OAuthSigningKeys } from "~/signing-keys.js";

function censorKey(key: OauthSigningKeyTableType) {
  return {
    id: key.id,
    parentId: key.parentId,
    childId: key.childId,

    createdByUserId: key.createdByUserId,

    status: key.status,

    alg: key.alg,
    use: key.use,

    publicKey: key.publicKey,

    expiresAt: key.expiresAt,
    renewsAt: key.renewsAt,
    createdAt: key.createdAt,
  } as const;
}

function censorServiceClient(client: OauthServiceClientTableType) {
  return {
    id: client.id,
    clientId: client.clientId,

    name: client.name,
    description: client.description,

    isSystemManaged: client.isSystemManaged,

    allowedAudiences: client.allowedAudiences,
    allowedScopes: client.allowedScopes,

    permissions: client.permissions,

    enabled: client.enabled,

    expiresAt: client.expiresAt,
    createdAt: client.createdAt,
  } as const;
}

export async function createRouteOAuthAdmin() {
  const serviceClients = container.resolve(OAuthServiceClients);
  const signingKeys = container.resolve(OAuthSigningKeys);

  const app = new Hono<InternalHonoApp>();

  app.get("/oauth/signing-keys/", createMiddlewareAuth(), async (c) => {
    const bouncer = c.get("bouncer")!;

    if (!bouncer.canReadOauthSigningKeyGenerally()) {
      return c.json(
        { success: false, message: "Insufficient Permissions" },
        403,
      );
    }

    const keys = await oauthSigningKeyModel.all();

    const result = keys
      .filter((key) => bouncer.canReadOauthSigningKey(key))
      .map(censorKey);

    return c.json({
      success: true,
      data: result,
    });
  });

  app.get("/oauth/signing-keys/:id", createMiddlewareAuth(), async (c) => {
    const bouncer = c.get("bouncer")!;

    const { id } = c.req.param();

    const key = await oauthSigningKeyModel.byId(id);

    if (!key) {
      return c.json({ success: false, message: "Key not found" }, 404);
    }

    if (!bouncer.canReadOauthSigningKey(key)) {
      return c.json(
        { success: false, message: "Insufficient Permissions" },
        403,
      );
    }

    return c.json({
      success: true,
      data: censorKey(key),
    });
  });

  app.put("/oauth/signing-keys/:id", createMiddlewareAuth(), async (c) => {
    const bouncer = c.get("bouncer")!;

    const { id } = c.req.param();

    const key = await oauthSigningKeyModel.byId(id);

    if (!key) {
      return c.json({ success: false, message: "Key not found" }, 404);
    }

    if (!bouncer.canWriteOauthSigningKey(key)) {
      return c.json(
        { success: false, message: "Insufficient Permissions" },
        403,
      );
    }

    const schema = z.object({
      status: z.enum(["active", "retiring", "inactive"]).optional(),
      expiresAt: z.string().datetime().nullable().optional(),
    });

    const body = await schema.parseAsync(await c.req.json(), {
      path: ["request", "body"],
    });

    await oauthSigningKeyModel.update(id, {
      status: body.status,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    });

    return c.json({
      success: true,
    });
  });

  app.post("/oauth/signing-keys/", createMiddlewareAuth(), async (c) => {
    const bouncer = c.get("bouncer")!;

    if (!bouncer.canWriteOauthSigningKeyGenerally()) {
      return c.json(
        { success: false, message: "Insufficient Permissions" },
        403,
      );
    }

    const schema = z.object({
      alg: z.enum(["RS256"]),
      use: z.enum(["sig", "enc"]),

      expiresAt: z.string().datetime().optional(),
      renewsAt: z.string().datetime().optional(),

      parentId: z.string().optional(),
    });

    const body = await schema.parseAsync(await c.req.json(), {
      path: ["request", "body"],
    });

    const key = await signingKeys.createSigningKey({
      alg: body.alg,
      use: body.use,

      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      renewsAt: body.renewsAt ? new Date(body.renewsAt) : undefined,

      parentId: body.parentId,
    });

    if (!key) {
      return c.json(
        { success: false, message: "Failed to create signing key" },
        500,
      );
    }

    return c.json({
      success: true,
      data: censorKey(key),
    });
  });

  app.get("/oauth/service-client/", createMiddlewareAuth(), async (c) => {
    const bouncer = c.get("bouncer")!;
    const hideDisabled = (c.req.query("hide-disabled") ?? "true") === "true";

    if (!bouncer.canReadOauthServiceClientGenerally()) {
      return c.json(
        { success: false, message: "Insufficient Permissions" },
        403,
      );
    }

    const serviceClients = hideDisabled
      ? await oauthServiceClientModel.byEnabled()
      : await oauthServiceClientModel.all();

    const result = serviceClients
      .filter((client) => bouncer.canReadOauthServiceClient(client))
      .map(censorServiceClient);

    return c.json({
      success: true,
      data: result,
    });
  });

  app.get("/oauth/service-client/:id", createMiddlewareAuth(), async (c) => {
    const bouncer = c.get("bouncer")!;

    const { id } = c.req.param();

    const client = await oauthServiceClientModel.byId(id);

    if (!client) {
      return c.json(
        { success: false, message: "Service Client not found" },
        404,
      );
    }

    if (!bouncer.canReadOauthServiceClient(client)) {
      return c.json(
        { success: false, message: "Insufficient Permissions" },
        403,
      );
    }

    return c.json({
      success: true,
      data: censorServiceClient(client),
    });
  });

  app.post("/oauth/service-client/", createMiddlewareAuth(), async (c) => {
    const bouncer = c.get("bouncer")!;

    if (!bouncer.canWriteOauthServiceClientGenerally()) {
      return c.json(
        { success: false, message: "Insufficient Permissions" },
        403,
      );
    }

    const schema = z.object({
      name: z.string(),
      description: z.string().optional(),

      allowedAudiences: z.array(z.string()).default([]),
      allowedScopes: z.array(z.string()).default([]),

      permissions: z.lazy(() => JobberPermissionsSchema),

      expiresAt: z.string().datetime().optional(),
    });

    const body = await schema.parseAsync(await c.req.json(), {
      path: ["request", "body"],
    });

    const { client, secret } = await serviceClients.upsertServiceClient({
      name: body.name,
      description: body.description,

      allowedAudiences: body.allowedAudiences,
      allowedScopes: body.allowedScopes,

      permissions: body.permissions,

      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    });

    if (!client) {
      return c.json(
        { success: false, message: "Failed to create service client" },
        500,
      );
    }

    return c.json({
      success: true,
      data: {
        client: censorServiceClient(client),
        secret,
      },
    });
  });

  return app;
}
