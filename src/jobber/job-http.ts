import { randomBytes } from "crypto";
import { SendHandleRequestHttp, SendHandleResponse } from "./job-controller.js";

type JobRoutes = {
  jobName: string;
  id: string;

  method: string;
  path: string;
};

export type JobHttpHandleEvent = (
  jobName: string,
  payload: SendHandleRequestHttp
) => Promise<SendHandleResponse>;

const reservedPaths = [/^\/jobber\//i];

export class JobHttp {
  private routes: Map<string, JobRoutes> = new Map();

  private onHandleEvent: null | JobHttpHandleEvent = null;

  public registerHandleEvent(handler: JobHttpHandleEvent) {
    this.onHandleEvent = handler;
  }

  public async run(payload: SendHandleRequestHttp) {
    if (payload.type !== "http") {
      throw new Error("Expecting type to be http");
    }

    if (!this.onHandleEvent) {
      throw new Error("Handle Event must be registered");
    }

    for (const reservedPath of reservedPaths) {
      if (reservedPath.test(payload.path)) {
        return null;
      }
    }

    for (const [routeId, route] of this.routes.entries()) {
      if (
        route.method.toLowerCase() === payload.method.toLowerCase() &&
        route.path === payload.path
      ) {
        return await this.onHandleEvent(route.jobName, payload);
      }
    }

    return null;
  }

  public createRoute(payload: Pick<JobRoutes, "path" | "method" | "jobName">) {
    for (const reservedPath of reservedPaths) {
      if (reservedPath.test(payload.path)) {
        throw new Error("Reserved path");
      }
    }

    const id = randomBytes(16).toString("hex");

    this.routes.set(id, {
      ...payload,
      id,
    });
  }

  public deleteRoutesByJobName(jobName: string) {
    for (const [scheduleId, schedule] of this.routes.entries()) {
      if (schedule.jobName === jobName) {
        this.routes.delete(scheduleId);
      }
    }
  }
}
