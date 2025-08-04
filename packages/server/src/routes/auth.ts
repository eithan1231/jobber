import {
  compare as bcryptCompare,
  genSalt as bcryptGenSalt,
  hash as bcryptHash,
} from "bcryptjs";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { z } from "zod";
import { getConfigOption } from "~/config.js";
import { getDrizzle } from "~/db/index.js";
import { sessionsTable } from "~/db/schema/sessions.js";
import {
  UserPasswordSchema,
  usersTable,
  UserUsernameSchema,
} from "~/db/schema/users.js";
import { InternalHonoApp } from "~/index.js";
import { createMiddlewareAuth } from "~/middleware/auth.js";
import { createMiddlewareResponseTime } from "~/middleware/response-time.js";

export async function createRouteAuth() {
  const app = new Hono<InternalHonoApp>();

  app.post(
    "/auth/login",
    createMiddlewareResponseTime(1292),
    async (c, next) => {
      if (!getConfigOption("AUTH_PUBLIC_LOGIN_ENABLED")) {
        return c.json(
          { success: false, message: "Public login is disabled" },
          403
        );
      }

      const schema = z
        .object({
          username: z.lazy(() => UserUsernameSchema),
          password: z.lazy(() => UserPasswordSchema),
        })
        .strict();

      const { username, password } = schema.parse(await c.req.json(), {
        path: ["request", "body"],
      });

      const user = (
        await getDrizzle()
          .select()
          .from(usersTable)
          .where(eq(usersTable.username, username))
          .limit(1)
      ).at(0);

      if (!user) {
        return c.json(
          { success: false, message: "Invalid username or password" },
          401
        );
      }

      const isValidPassword = await bcryptCompare(password, user.password);

      if (!isValidPassword) {
        return c.json(
          { success: false, message: "Invalid username or password" },
          401
        );
      }

      const session = await getDrizzle()
        .insert(sessionsTable)
        .values({
          userId: user.id,
          expires: new Date(Date.now() + 1000 * 60 * 60 * 24), // 1 day
        })
        .returning()
        .then((res) => res.at(0));

      if (!session) {
        throw new Error("Failed to create session");
      }

      setCookie(c, "jobber-session", session.token, {
        httpOnly: true,
        expires: session.expires,
      });

      return c.json({
        success: true,
        message: "Login successful",
        data: {
          session: {},
        },
      });
    }
  );

  app.post(
    "/auth/register",
    createMiddlewareResponseTime(1292),
    async (c, next) => {
      if (!getConfigOption("AUTH_PUBLIC_REGISTRATION_ENABLED")) {
        return c.json(
          { success: false, message: "Public registration is disabled" },
          403
        );
      }

      const schema = z
        .object({
          username: z.lazy(() => UserUsernameSchema),
          password: z.lazy(() => UserPasswordSchema),
        })
        .strict();

      const { username, password } = schema.parse(await c.req.json(), {
        path: ["request", "body"],
      });

      const existingUser = (
        await getDrizzle()
          .select()
          .from(usersTable)
          .where(eq(usersTable.username, username))
          .limit(1)
      ).at(0);

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
          permissions: [
            {
              effect: "deny",
              resource: "*",
              actions: ["read", "write", "delete"],
            },
          ],
        })
        .returning()
        .then((res) => res.at(0));

      if (!user) {
        return c.json(
          { success: false, message: "Failed to create user" },
          500
        );
      }

      const session = await getDrizzle()
        .insert(sessionsTable)
        .values({
          userId: user.id,
          expires: new Date(Date.now() + 1000 * 60 * 60 * 24), // 1 day
        })
        .returning()
        .then((res) => res.at(0));

      if (!session) {
        throw new Error("Failed to create session");
      }

      setCookie(c, "jobber-session", session.token, {
        httpOnly: true,
        expires: session.expires,
      });

      return c.json({
        success: true,
        message: "Registration successful",
        data: {
          user: {},
        },
      });
    }
  );

  // app.post("/auth/update-password", async (c, next) => {
  //   //
  // });

  app.get("/auth", createMiddlewareAuth(), async (c) => {
    const auth = c.get("auth")!;

    if (auth.type === "session") {
      return c.json({
        success: true,
        data: {
          permissions: auth.user.permissions,
          user: {
            id: auth.user.id,
            username: auth.user.username,
          },
        },
      });
    }

    if (auth.type === "token") {
      return c.json({
        success: true,
        data: {
          permissions: auth.token.permissions,
          token: {
            expires: auth.token.expires.toString(),
          },
        },
      });
    }

    throw new Error("Invalid auth type");
  });

  return app;
}
