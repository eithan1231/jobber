import { PERMISSION_SUPER } from "@jobber/common/permissions.js";
import { genSalt as bcryptGenSalt, hash as bcryptHash } from "bcryptjs";
import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { z } from "zod";
import { JOBBER_COOKIE } from "~/constants.js";
import { flagModel } from "~/db/flags.js";
import { getDrizzle } from "~/db/index.js";
import { sessionsTable, usersTable } from "~/db/schema.js";
import { UserPasswordSchema, UserUsernameSchema } from "~/db/types.js";
import { userModel } from "~/db/user.js";
import { InternalHonoApp } from "~/index.js";
import { hasSystemSetup } from "~/setup.js";

export async function createRouteSetup() {
  const app = new Hono<InternalHonoApp>();

  app.get("/setup/progress", async (c) => {
    return c.json({
      success: true,
      data: {
        hasAdminRegistered: await flagModel.getFlag("hasAdminRegistered"),
      },
    });
  });

  app.post("/setup/register", async (c, _next) => {
    if (await flagModel.getFlag("hasAdminRegistered")) {
      return c.status(403);
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

    const salt = await bcryptGenSalt(10);
    const hashedPassword = await bcryptHash(password, salt);

    const user = await getDrizzle()
      .insert(usersTable)
      .values({
        username: username,
        password: hashedPassword,
        permissions: PERMISSION_SUPER,
      })
      .returning()
      .then((res) => res.at(0));

    if (!user) {
      return c.json({ success: false, message: "Failed to create user" }, 500);
    }

    await flagModel.setFlag("hasAdminRegistered", true);

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

    setCookie(c, JOBBER_COOKIE, session.token, {
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
  });

  return app;
}
