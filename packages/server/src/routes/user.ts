import { genSalt as bcryptGenSalt, hash as bcryptHash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import assert from "node:assert";
import { z } from "zod";
import { getDrizzle } from "~/db/index.js";
import {
  UserPasswordSchema,
  usersTable,
  UserUsernameSchema,
} from "~/db/schema/users.js";
import { InternalHonoApp } from "~/index.js";
import { withLock } from "~/lock.js";
import { createMiddlewareAuth } from "~/middleware/auth.js";
import {
  canPerformAction,
  JobberPermissions,
  JobberPermissionsSchema,
} from "~/permissions.js";

export async function createRouteUser() {
  const app = new Hono<InternalHonoApp>();

  app.get("/users/", createMiddlewareAuth(), async (c) => {
    const auth = c.get("auth")!;

    if (!canPerformAction(auth.permissions, "users", "read")) {
      return c.json({ success: false, message: "Unauthorized" }, 403);
    }

    const users = await getDrizzle()
      .select({
        id: usersTable.id,
        username: usersTable.username,
        permissions: usersTable.permissions,
        created: usersTable.created,
      })
      .from(usersTable);

    const usersFiltered = users.filter((user) =>
      canPerformAction(auth.permissions, `users/${user.id}`, "read")
    );

    return c.json({
      success: true,
      message: "Users retrieved successfully",
      data: usersFiltered,
    });
  });

  app.get("/users/:id", createMiddlewareAuth(), async (c) => {
    const auth = c.get("auth")!;
    const userId = c.req.param("id");

    const user = await getDrizzle()
      .select({
        id: usersTable.id,
        username: usersTable.username,
        permissions: usersTable.permissions,
        created: usersTable.created,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1)
      .then((res) => res.at(0));

    if (!user) {
      return c.json({ success: false, message: "User not found" }, 404);
    }

    if (!canPerformAction(auth.permissions, `users/${user.id}`, "read")) {
      return c.json({ success: false, message: "Unauthorized" }, 403);
    }

    return c.json({
      success: true,
      message: "User retrieved successfully",
      data: user,
    });
  });

  app.post("/users/", createMiddlewareAuth(), async (c) => {
    const auth = c.get("auth")!;

    if (!canPerformAction(auth.permissions, "users", "write")) {
      return c.json({ success: false, message: "Unauthorized" }, 403);
    }

    const schema = z.object({
      username: z.lazy(() => UserUsernameSchema),
      password: z.lazy(() => UserPasswordSchema),
      permissions: z.lazy(() => JobberPermissionsSchema),
    });

    const body = schema.safeParse(await c.req.json());

    if (!body.success) {
      return c.json({ success: false, message: "Invalid request data" }, 400);
    }

    const { username, password, permissions } = body.data;

    const existingUser = await getDrizzle()
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, username))
      .limit(1)
      .then((res) => res.at(0));

    if (existingUser) {
      return c.json(
        { success: false, message: "Username already exists" },
        409
      );
    }

    const salt = await bcryptGenSalt(10);
    const hashedPassword = await bcryptHash(password, salt);

    const user = await getDrizzle()
      .insert(usersTable)
      .values({
        username: username,
        password: hashedPassword,
        permissions: permissions,
      })
      .returning()
      .then((res) => res.at(0));

    if (!user) {
      return c.json({ success: false, message: "Failed to create user" }, 500);
    }

    return c.json({
      success: true,
      message: "User created successfully",
      data: {
        id: user.id,
        username: user.username,
        permissions: user.permissions,
        created: user.created,
      },
    });
  });

  app.put("/users/:id", createMiddlewareAuth(), async (c) => {
    const auth = c.get("auth")!;
    const userId = c.req.param("id");

    const schema = z.object({
      username: z.lazy(() => UserUsernameSchema).optional(),
      password: z.lazy(() => UserPasswordSchema).optional(),
      permissions: z.lazy(() => JobberPermissionsSchema).optional(),
    });

    const body = schema.safeParse(await c.req.json());

    if (!body.success) {
      return c.json({ success: false, message: "Invalid request data" }, 400);
    }

    const user = await getDrizzle()
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1)
      .then((res) => res.at(0));

    if (!user) {
      return c.json({ success: false, message: "User not found" }, 404);
    }

    if (!canPerformAction(auth.permissions, `users/${user.id}`, "write")) {
      return c.json({ success: false, message: "Unauthorized" }, 403);
    }

    return await withLock("users", userId, async () => {
      const updates: Partial<{
        username: string;
        password: string;
        permissions: JobberPermissions;
      }> = {};

      if (body.data.username) {
        if (
          !canPerformAction(
            auth.permissions,
            `users/${user.id}/username`,
            "write"
          )
        ) {
          return c.json(
            { success: false, message: "Unauthorized to change username" },
            403
          );
        }

        updates.username = body.data.username;
      }

      if (body.data.password) {
        if (
          !canPerformAction(
            auth.permissions,
            `users/${user.id}/password`,
            "write"
          )
        ) {
          return c.json(
            { success: false, message: "Unauthorized to change password" },
            403
          );
        }

        const salt = await bcryptGenSalt(10);
        updates.password = await bcryptHash(body.data.password, salt);
      }

      if (body.data.permissions) {
        if (
          !canPerformAction(
            auth.permissions,
            `users/${user.id}/permissions`,
            "write"
          )
        ) {
          return c.json(
            { success: false, message: "Unauthorized to change permissions" },
            403
          );
        }

        updates.permissions = body.data.permissions;
      }

      const updatesUser = await getDrizzle()
        .update(usersTable)
        .set(updates)
        .where(eq(usersTable.id, userId))
        .returning()
        .then((res) => res.at(0));

      assert(updatesUser, "updatesUser should not be falsy");

      return c.json({
        success: true,
        message: "User updated successfully",
        data: {
          id: updatesUser.id,
          username: updatesUser.username,
          permissions: updatesUser.permissions,
          created: updatesUser.created,
        },
      });
    });
  });

  return app;
}
