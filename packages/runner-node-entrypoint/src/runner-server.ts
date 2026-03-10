import { BouncerBase } from "@jobber/common/bouncer-base.js";
import { deferred } from "@jobber/common/deferred.js";
import { JobberPermissionsSchema } from "@jobber/common/permissions.js";
import { RunnerAPIDefinition } from "@jobber/grpc/runner.js";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { JOSEError } from "jose/errors";
import {
  CallContext,
  createServer,
  ServerError,
  ServiceImplementation,
  Status,
} from "nice-grpc";
import assert from "node:assert";
import { HttpContext } from "./context/http.js";
import { LegacyContext } from "./context/legacy-context.js";
import { LegacyContextRequest } from "./context/legacy-request.js";
import { LegacyContextResponse } from "./context/legacy-response.js";
import { MqttContext } from "./context/mqtt.js";
import { ScheduleContext } from "./context/schedule.js";
import { Runner } from "./runner.js";
import { getOAuthAudienceRunnerApi } from "@jobber/common/oauth.js";
import { RunnerOptions } from "./options.js";

export class RunnerServer {
  private jwks: ReturnType<typeof createRemoteJWKSet>;

  private server: ReturnType<typeof createServer> | null = null;

  constructor(
    private runner: Runner,
    private options: RunnerOptions,
  ) {
    this.jwks = createRemoteJWKSet(
      new URL(this.options.runnerOAuthJwksEndpoint),
      {
        cacheMaxAge: 5 * 60 * 1000,
      },
    );
  }

  private async getBouncer(context: CallContext) {
    try {
      let token = context.metadata.get("Authorization");

      if (!token) {
        throw new ServerError(Status.UNAUTHENTICATED, "Unauthenticated");
      }

      if (token.startsWith("Bearer ")) {
        token = token.slice("Bearer ".length);
      }

      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.options.runnerOAuthIssuer,
        audience: getOAuthAudienceRunnerApi(this.options.runnerId),
      });

      const permissions = await JobberPermissionsSchema.parseAsync(
        payload.permissions,
      );

      return new BouncerBase(permissions);
    } catch (err) {
      if (err instanceof ServerError) {
        throw err;
      }

      if (err instanceof JOSEError) {
        console.log("gRPC Unauthorized error:", err);
        throw new ServerError(Status.UNAUTHENTICATED, "Unauthenticated");
      }

      console.log("gRPC Internal server error:", err);
      throw new ServerError(Status.INTERNAL, "Internal server error");
    }
  }

  private getServiceImplementation(
    thisWas: this,
  ): ServiceImplementation<RunnerAPIDefinition> {
    return {
      status: async (request, context) => {
        const bouncer = await thisWas.getBouncer(context);

        if (!bouncer.canReadRunnerStatus({ id: thisWas.runner.jobId })) {
          throw new ServerError(
            Status.PERMISSION_DENIED,
            "Permission denied to read job status",
          );
        }

        if (thisWas.runner.status === "starting") {
          return {
            status: "STARTING",
            lastRequestAt: thisWas.runner.telemetry.lastRequestAt,
            loadAverage5Second: thisWas.runner.telemetry.loadAverage5Second,
            loadAverage60Second: thisWas.runner.telemetry.loadAverage60Second,
          };
        }

        if (thisWas.runner.status === "running") {
          return {
            status: "READY",
            lastRequestAt: thisWas.runner.telemetry.lastRequestAt,
            loadAverage5Second: thisWas.runner.telemetry.loadAverage5Second,
            loadAverage60Second: thisWas.runner.telemetry.loadAverage60Second,
          };
        }

        if (thisWas.runner.status === "closing") {
          return {
            status: "CLOSING",
            lastRequestAt: thisWas.runner.telemetry.lastRequestAt,
            loadAverage5Second: thisWas.runner.telemetry.loadAverage5Second,
            loadAverage60Second: thisWas.runner.telemetry.loadAverage60Second,
          };
        }

        if (thisWas.runner.status === "pending") {
          return {
            status: "CLOSED",
            lastRequestAt: thisWas.runner.telemetry.lastRequestAt,
            loadAverage5Second: thisWas.runner.telemetry.loadAverage5Second,
            loadAverage60Second: thisWas.runner.telemetry.loadAverage60Second,
          };
        }

        return {
          status: "UNRECOGNIZED",
          lastRequestAt: 0,
          loadAverage5Second: 0,
          loadAverage60Second: 0,
        };
      },

      eventHttp: async function* (request, context) {
        const bouncer = await thisWas.getBouncer(context);

        if (!bouncer.canInvokeRunnerHttpEvent({ id: thisWas.runner.jobId })) {
          throw new ServerError(
            Status.PERMISSION_DENIED,
            "Permission denied to invoke HTTP event",
          );
        }

        // TODO: Setup some sort of timeout.

        const httpContext = new HttpContext(thisWas.runner, request);
        const executionComplete = deferred<void>();

        // Ensure headers are received before processing event
        httpContext.request._startStreamingEvents(); // Do not await
        await httpContext.request.receivedHeadersPromise; // Resolves when headers are received.

        thisWas.runner.telemetry.notifyRequest();

        if (thisWas.runner.module.handlerHttp) {
          const result = thisWas.runner.module.handlerHttp(httpContext);

          if (result instanceof Promise) {
            await result;
          }

          executionComplete.resolve();
        } else if (thisWas.runner.module.handler) {
          const legacyRequest = new LegacyContextRequest(httpContext);
          await legacyRequest._externalProcess(); // Legacy method streamed entire body into memory (yuck)

          const legacyResponse = new LegacyContextResponse(httpContext);
          const legacyContext = new LegacyContext(thisWas.runner);

          setImmediate(async () => {
            assert(thisWas?.runner?.module?.handler, "Handler should exist");

            const result = thisWas.runner.module.handler(
              legacyRequest,
              legacyResponse,
              legacyContext,
            );

            if (result instanceof Promise) {
              await result;
            }

            legacyResponse._externalProcess();

            executionComplete.resolve();
          });
        }

        yield* httpContext.createResponse();

        await executionComplete.promise;

        if (thisWas.options.runnerDebug) {
          console.log("HTTP event processing complete");
        }
      },

      eventMqtt: async (request, context) => {
        const bouncer = await thisWas.getBouncer(context);

        if (!bouncer.canInvokeRunnerMqttEvent({ id: thisWas.runner.jobId })) {
          throw new ServerError(
            Status.PERMISSION_DENIED,
            "Permission denied to invoke MQTT event",
          );
        }

        const mqttContext = new MqttContext(thisWas.runner, request);

        thisWas.runner.telemetry.notifyRequest();

        if (thisWas.runner.module.handlerMqtt) {
          const result = thisWas.runner.module.handlerMqtt(mqttContext);

          if (result instanceof Promise) {
            await result;
          }
        } else if (thisWas.runner.module.handler) {
          const legacyRequest = new LegacyContextRequest(mqttContext);
          const legacyResponse = new LegacyContextResponse(mqttContext);
          const legacyContext = new LegacyContext(thisWas.runner);

          const result = thisWas.runner.module.handler(
            legacyRequest,
            legacyResponse,
            legacyContext,
          );

          if (result instanceof Promise) {
            await result;
          }
        }

        return mqttContext.createResponse();
      },

      eventSchedule: async (request, context) => {
        const bouncer = await thisWas.getBouncer(context);

        if (
          !bouncer.canInvokeRunnerScheduleEvent({ id: thisWas.runner.jobId })
        ) {
          throw new ServerError(
            Status.PERMISSION_DENIED,
            "Permission denied to invoke Schedule event",
          );
        }

        const scheduleContext = new ScheduleContext(this.runner, request);

        thisWas.runner.telemetry.notifyRequest();

        if (this.runner.module.handlerSchedule) {
          const result = this.runner.module.handlerSchedule(scheduleContext);

          if (result instanceof Promise) {
            await result;
          }
        } else if (this.runner.module.handler) {
          const legacyRequest = new LegacyContextRequest(scheduleContext);
          const legacyResponse = new LegacyContextResponse(scheduleContext);
          const legacyContext = new LegacyContext(this.runner);

          const result = this.runner.module.handler(
            legacyRequest,
            legacyResponse,
            legacyContext,
          );

          if (result instanceof Promise) {
            await result;
          }
        }

        return scheduleContext.createResponse();
      },
    };
  }

  public async start() {
    this.server = createServer();

    this.server.add(RunnerAPIDefinition, this.getServiceImplementation(this));

    await this.server.listen(`0.0.0.0:${this.options.runnerApiPort}`);
  }

  public async stop() {
    await this.server?.shutdown();
  }
}
