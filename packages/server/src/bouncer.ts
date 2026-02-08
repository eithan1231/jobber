import { ApiTokensTableType } from "./db/schema/api-tokens.js";
import { SessionsTableType } from "./db/schema/sessions.js";
import { UsersTableType } from "./db/schema/users.js";
import { JobberPermissions } from "@jobber/common/permissions.js";
import { BouncerBase } from "@jobber/common/bouncer-base.js";

type BouncerOptions =
  | {
      type: "anonymous";
      user: UsersTableType;
      permissions: JobberPermissions;
    }
  | {
      type: "session";
      user: UsersTableType;
      session: SessionsTableType;
      permissions: JobberPermissions;
    }
  | {
      type: "token";
      token: ApiTokensTableType;
      permissions: JobberPermissions;
    };

/**
 * Bouncer class is a abstraction for nicely handling permission checks and access
 * control. It will be loaded into the Hono app context on all requests.
 */
export class Bouncer extends BouncerBase {
  private options: BouncerOptions;

  constructor(options: BouncerOptions) {
    super(options.permissions);
    this.options = options;
  }

  public get type() {
    return this.options.type;
  }

  public get userId() {
    if (this.options.type === "token") {
      return this.options.token.userId;
    }

    return this.options.user.id;
  }

  public get permissions() {
    return this.options.permissions;
  }

  public get token() {
    if (this.options.type !== "token") {
      return null;
    }

    return this.options.token;
  }

  public get user() {
    if (this.options.type === "token") {
      return null;
    }

    return this.options.user;
  }

  public get session() {
    if (this.options.type !== "session") {
      return null;
    }

    return this.options.session;
  }
}
