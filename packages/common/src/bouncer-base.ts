import {
  canPerformAction,
  JobberPermissionAction,
  JobberPermissions,
} from "./permissions.js";

export class BouncerBase {
  private _permissions;

  constructor(permissions: JobberPermissions) {
    this._permissions = permissions;
  }

  public can(resource: string, action: JobberPermissionAction): boolean {
    return canPerformAction(this._permissions, resource, action);
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
    name: string,
  ): boolean {
    return this.can(`job/${environment.jobId}/environment/${name}`, "read");
  }

  public canWriteJobEnvironment(
    environment: { jobId: string },
    name: string,
  ): boolean {
    return this.can(`job/${environment.jobId}/environment/${name}`, "write");
  }

  public canDeleteJobEnvironment(
    environment: { jobId: string },
    name: string,
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

  public canReadJobStore(item: { jobId: string }): boolean {
    return this.can(`job/${item.jobId}/store`, "read");
  }

  public canWriteJobStore(item: { jobId: string }): boolean {
    return this.can(`job/${item.jobId}/store`, "write");
  }

  public canDeleteJobStore(item: { jobId: string }): boolean {
    return this.can(`job/${item.jobId}/store`, "delete");
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

  public canReadOauthServiceClientGenerally(): boolean {
    return this.can(`oauth/service-client`, "read");
  }

  public canWriteOauthServiceClientGenerally(): boolean {
    return this.can(`oauth/service-client`, "read");
  }

  public canReadOauthServiceClient(serviceClient: { id: string }): boolean {
    return this.can(`oauth/service-client/${serviceClient.id}`, "read");
  }

  public canWriteOauthServiceClient(serviceClient: { id: string }): boolean {
    return this.can(`oauth/service-client/${serviceClient.id}`, "write");
  }

  public canDeleteOauthServiceClient(serviceClient: { id: string }): boolean {
    return this.can(`oauth/service-client/${serviceClient.id}`, "delete");
  }

  public canReadOauthSigningKeyGenerally(): boolean {
    return this.can(`oauth/signing-key`, "read");
  }

  public canWriteOauthSigningKeyGenerally(): boolean {
    return this.can(`oauth/signing-key`, "write");
  }

  public canReadOauthSigningKey(signingKey: { id: string }): boolean {
    return this.can(`oauth/signing-key/${signingKey.id}`, "read");
  }

  public canWriteOauthSigningKey(signingKey: { id: string }): boolean {
    return this.can(`oauth/signing-key/${signingKey.id}`, "write");
  }

  public canDeleteOauthSigningKey(signingKey: { id: string }): boolean {
    return this.can(`oauth/signing-key/${signingKey.id}`, "delete");
  }

  /**
   * SPECIAL: This is a special case to allow runners to publish MQTT messages
   */
  public canPublishMqttMessage(job: { id: string }): boolean {
    return this.can(`special/job/${job.id}/publish-mqtt`, "write");
  }
}
