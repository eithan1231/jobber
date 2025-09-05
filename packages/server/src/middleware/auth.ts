import { eq } from "drizzle-orm";
import { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { USERNAME_ANONYMOUS } from "~/constants.js";
import { getDrizzle } from "~/db/index.js";
import { apiTokensTable } from "~/db/schema/api-tokens.js";
import { sessionsTable } from "~/db/schema/sessions.js";
import { usersTable } from "~/db/schema/users.js";
import { InternalHonoApp } from "~/index.js";

const extractApiToken = (c: Context<InternalHonoApp>) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(" ", 2);

  if (parts.length !== 2) {
    return null;
  }

  if (parts[0].toLowerCase() !== "bearer") {
    return null;
  }

  if (parts[1].length === 0) {
    return null;
  }

  return parts[1];
};

export const createMiddlewareAuth = () => {
  return async (c: Context<InternalHonoApp>, next: Next) => {
    const sessionToken = getCookie(c, "jobber-session");

    if (sessionToken) {
      const result = await getDrizzle()
        .select()
        .from(sessionsTable)
        .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
        .where(eq(sessionsTable.token, sessionToken))
        .limit(1)
        .then((res) => res.at(0));

      if (!result) {
        return c.json(
          { success: false, message: "Insufficient Permissions" },
          403
        );
      }

      const { users, sessions } = result;

      if (!users.enabled) {
        return c.json(
          { success: false, message: "Insufficient Permissions" },
          403
        );
      }

      if (sessions.expires < new Date()) {
        return c.json(
          { success: false, message: "Insufficient Permissions" },
          403
        );
      }

      if (sessions.status === "disabled") {
        return c.json(
          { success: false, message: "Insufficient Permissions" },
          403
        );
      }

      c.set("auth", {
        type: "session",
        user: users,
        session: sessions,
        permissions: users.permissions,
      });

      return await next();
    }

    const token = extractApiToken(c);

    if (token) {
      const apiToken = await getDrizzle()
        .select()
        .from(apiTokensTable)
        .where(eq(apiTokensTable.token, token))
        .limit(1)
        .then((res) => res.at(0));

      if (!apiToken) {
        return c.json(
          { success: false, message: "Insufficient Permissions" },
          403
        );
      }

      if (apiToken.expires < new Date()) {
        return c.json(
          { success: false, message: "Insufficient Permissions" },
          403
        );
      }

      if (apiToken.status !== "enabled") {
        return c.json(
          { success: false, message: "Insufficient Permissions" },
          403
        );
      }

      c.set("auth", {
        type: "token",
        token: apiToken,
        permissions: apiToken.permissions,
      });

      return await next();
    }

    // Anonymous User
    const anonymousUser = await getDrizzle()
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, USERNAME_ANONYMOUS))
      .limit(1)
      .then((res) => res.at(0) ?? null);

    if (!anonymousUser) {
      return c.json(
        { success: false, message: "Insufficient Permissions" },
        403
      );
    }

    if (!anonymousUser.enabled) {
      return c.json(
        { success: false, message: "Insufficient Permissions" },
        403
      );
    }

    if (
      !anonymousUser.permissions.some(
        (permission) => permission.effect === "allow"
      )
    ) {
      // The anonymous user doesn't have any allow permissions, safe to assume they are
      // going to be rejected downstream
      return c.json(
        { success: false, message: "Insufficient Permissions" },
        403
      );
    }

    c.set("auth", {
      type: "anonymous",
      user: anonymousUser,
      permissions: anonymousUser.permissions,
    });

    return await next();
  };
};
