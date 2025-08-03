import {
  compare as bcryptCompare,
  genSalt as bcryptGenSalt,
  hash as bcryptHash,
} from "bcryptjs";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { z } from "zod";
import { getDrizzle } from "~/db/index.js";
import { sessionsTable } from "~/db/schema/sessions.js";
import { usersTable } from "~/db/schema/users.js";
import { InternalHonoApp } from "~/index.js";
import { createMiddlewareAuth } from "~/middleware/auth.js";
import { createMiddlewareResponseTime } from "~/middleware/response-time.js";

export async function createRouteAuth() {
  const app = new Hono<InternalHonoApp>();

  app.post(
    "/auth/login",
    createMiddlewareResponseTime(1292),
    async (c, next) => {
      const schema = z
        .object({
          username: z.string().min(1),
          password: z.string().min(1),
        })
        .strict();

      const { username, password } = schema.parse(await c.req.json());

      const user = (
        await getDrizzle()
          .select()
          .from(usersTable)
          .where(eq(usersTable.username, username))
          .limit(1)
      ).at(0);

      if (!user) {
        return c.json({ error: "Invalid username or password" }, 401);
      }

      const isValidPassword = await bcryptCompare(password, user.password);

      if (!isValidPassword) {
        return c.json({ error: "Invalid username or password" }, 401);
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
      const schema = z
        .object({
          username: z.string().min(1),
          password: z.string().min(1),
        })
        .strict();

      const { username, password } = schema.parse(await c.req.json());

      const existingUser = (
        await getDrizzle()
          .select()
          .from(usersTable)
          .where(eq(usersTable.username, username))
          .limit(1)
      ).at(0);

      if (existingUser) {
        return c.json({ error: "Username already exists" }, 409);
      }

      const salt = await bcryptGenSalt(10);
      const hashedPassword = await bcryptHash(password, salt);

      const user = await getDrizzle()
        .insert(usersTable)
        .values({
          username,
          password: hashedPassword,
          permissions: [
            {
              effect: "allow",
              resource: "*",
              actions: ["read", "write", "delete", "execute"],
            },
          ],
        })
        .returning()
        .then((res) => res.at(0));

      if (!user) {
        return c.json({ error: "Failed to create user" }, 500);
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
