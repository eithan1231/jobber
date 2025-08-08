import { eq } from "drizzle-orm";
import { Hono } from "hono";
import assert from "node:assert";
import { z } from "zod";
import { getDrizzle } from "~/db/index.js";
import { apiTokensTable, ApiTokensTableType } from "~/db/schema/api-tokens.js";
import { InternalHonoApp } from "~/index.js";
import { withLock } from "~/lock.js";
import { createMiddlewareAuth } from "~/middleware/auth.js";
import { canPerformAction, JobberPermissionsSchema } from "~/permissions.js";

export async function createRouteApiTokens() {
  const app = new Hono<InternalHonoApp>();

  app.get("/api-tokens/", createMiddlewareAuth(), async (c) => {
    const auth = c.get("auth")!;

    if (!canPerformAction(auth.permissions, "api-tokens", "read")) {
      return c.json({ success: false, message: "Unauthorized" }, 403);
    }

    const tokens = await getDrizzle()
      .select({
        id: apiTokensTable.id,
        userId: apiTokensTable.userId,
        description: apiTokensTable.description,
        permissions: apiTokensTable.permissions,
        status: apiTokensTable.status,
        created: apiTokensTable.created,
        expires: apiTokensTable.expires,
      })
      .from(apiTokensTable);

    const tokensFiltered = tokens.filter((token) =>
      canPerformAction(auth.permissions, `api-tokens/${token.id}`, "read")
    );

    return c.json({
      success: true,
      message: "API tokens retrieved successfully",
      data: tokensFiltered,
    });
  });

  app.get("/api-tokens/:tokenId", createMiddlewareAuth(), async (c) => {
    const auth = c.get("auth")!;
    const tokenId = c.req.param("tokenId");

    if (!canPerformAction(auth.permissions, "api-tokens", "read")) {
      return c.json({ success: false, message: "Unauthorized" }, 403);
    }

    const token = await getDrizzle()
      .select({
        id: apiTokensTable.id,
        userId: apiTokensTable.userId,
        description: apiTokensTable.description,
        permissions: apiTokensTable.permissions,
        status: apiTokensTable.status,
        created: apiTokensTable.created,
        expires: apiTokensTable.expires,
      })
      .from(apiTokensTable)
      .where(eq(apiTokensTable.id, tokenId))
      .limit(1)
      .then((res) => res[0]);

    if (!canPerformAction(auth.permissions, `api-tokens/${token.id}`, "read")) {
      return c.json({ success: false, message: "Unauthorized" }, 403);
    }

    return c.json({
      success: true,
      message: "API tokens retrieved successfully",
      data: token,
    });
  });

  app.post("/api-tokens/", createMiddlewareAuth(), async (c) => {
    const auth = c.get("auth")!;

    if (!canPerformAction(auth.permissions, "api-tokens", "write")) {
      return c.json({ success: false, message: "Unauthorized" }, 403);
    }

    const schema = z
      .object({
        permissions: z.lazy(() => JobberPermissionsSchema),
        description: z.string().min(1).max(1024),
        ttl: z
          .number()
          .min(60)
          .max(60 * 60 * 24 * 365 * 5),
      })
      .strict();
    //

    const body = schema.safeParse(await c.req.json());

    if (!body.success) {
      return c.json({ success: false, message: "Invalid request body" }, 400);
    }

    const { permissions } = body.data;
    const userId = auth.type === "session" ? auth.user.id : auth.token.userId;
    const expires = new Date(Date.now() + body.data.ttl * 1000);
    const description = body.data.description;

    const token = await getDrizzle()
      .insert(apiTokensTable)
      .values({
        permissions,
        description,
        userId,
        expires: expires,
      })
      .returning()
      .then((res) => res[0]);
    //

    assert(token, "Token creation failed");

    return c.json({
      success: true,
      message: "API token created successfully",
      data: {
        id: token.id,
        token: token.token,
        description: token.description,
        userId: token.userId,
        permissions: token.permissions,
        status: token.status,
        created: token.created,
        expires: token.expires,
      },
    });
  });

  app.put("/api-tokens/:tokenId", createMiddlewareAuth(), async (c) => {
    const auth = c.get("auth")!;
    const tokenId = c.req.param("tokenId");

    if (!canPerformAction(auth.permissions, "api-tokens", "write")) {
      return c.json({ success: false, message: "Unauthorized" }, 403);
    }

    const token = await getDrizzle()
      .select()
      .from(apiTokensTable)
      .where(eq(apiTokensTable.id, tokenId))
      .limit(1)
      .then((res) => res[0]);

    if (!token) {
      return c.json({ success: false, message: "API token not found" }, 404);
    }

    if (
      !canPerformAction(auth.permissions, `api-tokens/${token.id}`, "write")
    ) {
      return c.json({ success: false, message: "Unauthorized" }, 403);
    }

    const schema = z
      .object({
        permissions: z.lazy(() => JobberPermissionsSchema).optional(),
        status: z.enum(["enabled", "disabled"]).optional(),
        description: z.string().min(1).max(1024).optional(),
      })
      .strict();

    const body = schema.safeParse(await c.req.json());

    if (!body.success) {
      return c.json({ success: false, message: "Invalid request body" }, 400);
    }

    const { permissions, status, description } = body.data;

    return await withLock("api-tokens", token.id, async () => {
      const updateData: Partial<
        Pick<ApiTokensTableType, "status" | "permissions" | "description">
      > = {};

      if (permissions) {
        updateData.permissions = permissions;
      }

      if (status) {
        updateData.status = status;
      }

      if (description) {
        updateData.description = description;
      }

      await getDrizzle()
        .update(apiTokensTable)
        .set(updateData)
        .where(eq(apiTokensTable.id, tokenId));

      return c.json({
        success: true,
        message: "API token updated successfully",
        data: {
          id: token.id,
          userId: token.userId,
          description: token.description,
          permissions: permissions ?? token.permissions,
          status: status ?? token.status,
          created: token.created,
          expires: token.expires,
        },
      });
    });
  });

  return app;
}
