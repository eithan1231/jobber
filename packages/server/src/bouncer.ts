import assert from "node:assert";
import { ApiTokensTableType } from "./db/schema/api-tokens.js";
import { SessionsTableType } from "./db/schema/sessions.js";
import { UsersTableType } from "./db/schema/users.js";
import {
  canPerformAction,
  JobberPermissionAction,
  JobberPermissions,
} from "./permissions.js";
import { HTTPException } from "hono/http-exception";
import { JobsTableType } from "./db/schema/jobs.js";

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
export class Bouncer {
  private options: BouncerOptions;

  constructor(options: BouncerOptions) {
    this.options = options;
  }

  public can(resource: string, action: JobberPermissionAction): boolean {
    return canPerformAction(this.options.permissions, resource, action);
  }

  public canOrFail(resource: string, action: JobberPermissionAction): void {
    if (!this.can(resource, action)) {
      throw new HTTPException(403, {
        message: "Insufficient Permissions",
      });
    }
  }

  public canRead(resource: string): boolean {
    return this.can(resource, "read");
  }

  public canWrite(resource: string): boolean {
    return this.can(resource, "write");
  }

  public canDelete(resource: string): boolean {
    return this.can(resource, "delete");
  }

  public canReadJob(job: { id: string }): boolean {
    return this.can(`job/${job.id}`, "read");
  }

  public canWriteJob(job: { id: string }): boolean {
    return this.can(`job/${job.id}`, "write");
  }

  public canDeleteJob(job: { id: string }): boolean {
    return this.can(`job/${job.id}`, "delete");
  }

  public canReadJobEnvironment(
    environment: { jobId: string },
    name: string
  ): boolean {
    return this.can(`job/${environment.jobId}/environment/${name}`, "read");
  }

  public canWriteJobEnvironment(
    environment: { jobId: string },
    name: string
  ): boolean {
    return this.can(`job/${environment.jobId}/environment/${name}`, "write");
  }

  public canDeleteJobEnvironment(
    environment: { jobId: string },
    name: string
  ): boolean {
    return this.can(`job/${environment.jobId}/environment/${name}`, "delete");
  }

  public canReadJobAction(action: { jobId: string; id: string }): boolean {
    return this.can(`job/${action.jobId}/actions/${action.id}`, "read");
  }

  public canWriteJobAction(action: { jobId: string; id: string }): boolean {
    return this.can(`job/${action.jobId}/actions/${action.id}`, "write");
  }

  public canDeleteJobAction(action: { jobId: string; id: string }): boolean {
    return this.can(`job/${action.jobId}/actions/${action.id}`, "delete");
  }

  public canReadJobRunners(job: { id: string }): boolean {
    return this.can(`job/${job.id}/runners`, "read");
  }

  public canWriteJobRunners(job: { id: string }): boolean {
    return this.can(`job/${job.id}/runners`, "write");
  }

  public canDeleteJobRunners(job: { id: string }): boolean {
    return this.can(`job/${job.id}/runners`, "delete");
  }

  public canReadJobStoreItem(item: { jobId: string; id: string }): boolean {
    return this.can(`job/${item.jobId}/store/${item.id}`, "read");
  }

  public canWriteJobStoreItem(item: { jobId: string; id: string }): boolean {
    return this.can(`job/${item.jobId}/store/${item.id}`, "write");
  }

  public canDeleteJobStoreItem(item: { jobId: string; id: string }): boolean {
    return this.can(`job/${item.jobId}/store/${item.id}`, "delete");
  }

  public canReadJobTriggers(trigger: { jobId: string; id: string }): boolean {
    return this.can(`job/${trigger.jobId}/triggers/${trigger.id}`, "read");
  }

  public canWriteJobTriggers(trigger: { jobId: string; id: string }): boolean {
    return this.can(`job/${trigger.jobId}/triggers/${trigger.id}`, "write");
  }

  public canDeleteJobTriggers(trigger: { jobId: string; id: string }): boolean {
    return this.can(`job/${trigger.jobId}/triggers/${trigger.id}`, "delete");
  }

  public canReadJobVersion(version: { jobId: string; id: string }): boolean {
    return this.can(`job/${version.jobId}/versions/${version.id}`, "read");
  }

  public canJobPublish(): boolean {
    return this.can(`job/-/publish`, "write");
  }

  public canReadApiTokenGenerally(): boolean {
    return this.can(`api-tokens`, "read");
  }

  public canWriteApiTokenGenerally(): boolean {
    return this.can(`api-tokens`, "write");
  }

  public canDeleteApiTokenGenerally(): boolean {
    return this.can(`api-tokens`, "delete");
  }

  public canReadApiToken(token: { id: string }): boolean {
    return this.can(`api-tokens/${token.id}`, "read");
  }

  public canWriteApiToken(token: { id: string }): boolean {
    return this.can(`api-tokens/${token.id}`, "write");
  }

  public canDeleteApiToken(token: { id: string }): boolean {
    return this.can(`api-tokens/${token.id}`, "delete");
  }

  public canReadSystemMetricsPrometheus(): boolean {
    return this.can(`system/metrics/prometheus`, "read");
  }

  public canReadSystemMetricsOverview(): boolean {
    return this.can(`system/metrics/overview`, "read");
  }

  public canReadUserGenerally(): boolean {
    return this.can(`users`, "read");
  }

  public canWriteUserGenerally(): boolean {
    return this.can(`users`, "write");
  }

  public canDeleteUserGenerally(): boolean {
    return this.can(`users`, "delete");
  }

  public canReadUser(user: { id: string }): boolean {
    return this.can(`users/${user.id}`, "read");
  }

  public canWriteUser(user: { id: string }): boolean {
    return this.can(`users/${user.id}`, "write");
  }

  public canDeleteUser(user: { id: string }): boolean {
    return this.can(`users/${user.id}`, "delete");
  }

  public canWriteUserUsername(user: { id: string }): boolean {
    return this.can(`users/${user.id}/username`, "write");
  }

  public canWriteUserPassword(user: { id: string }): boolean {
    return this.can(`users/${user.id}/password`, "write");
  }

  public canWriteUserPermissions(user: { id: string }): boolean {
    return this.can(`users/${user.id}/permissions`, "write");
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
