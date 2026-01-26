import { LoopBase } from "@jobber/common";
import { GeneralManagementDefinition } from "@jobber/grpc/server.js";
import {
  CallContext,
  createServer,
  Server,
  ServiceImplementation,
  ServerError,
  Status,
} from "nice-grpc";
import { container, singleton } from "tsyringe";
import { Bouncer } from "~/bouncer.js";
import { getConfigOption } from "~/config.js";
import { apiTokensModel } from "~/db/api-tokens.js";

import { SignJWT } from "jose";
import { RunnerManager } from "~/jobber/runners/manager.js";

const authorizedCall = <TRequest, TResponse>(
  callback: (
    request: TRequest,
    context: CallContext,
    bouncer: Bouncer
  ) => Promise<TResponse>
) => {
  return async (
    request: TRequest,
    context: CallContext
  ): Promise<TResponse> => {
    try {
      const token = context.metadata.get("authorization");

      if (!token) {
        throw new ServerError(Status.UNAUTHENTICATED, "Unauthenticated");
      }

      const apiToken = await apiTokensModel.byValidToken(token);

      if (!apiToken) {
        throw new ServerError(Status.UNAUTHENTICATED, "Unauthenticated");
      }

      const bouncer = new Bouncer({
        type: "token",
        token: apiToken,
        permissions: apiToken.permissions,
      });

      return callback(request, context, bouncer);
    } catch (err) {
      if (err instanceof ServerError) {
        throw err;
      }

      console.log("gRPC Internal server error:", err);
      throw new ServerError(Status.INTERNAL, "Internal server error");
    }
  };
};

const generalManagementDefinition: ServiceImplementation<GeneralManagementDefinition> =
  {
    createRunnerJwt: authorizedCall(async (request, context, bouncer) => {
      if (!bouncer.canWriteGrpcRunnerJwt()) {
        throw new ServerError(
          Status.PERMISSION_DENIED,
          "Insufficient Permissions"
        );
      }

      // ensure runner exists
      const manager = container.resolve(RunnerManager);

      const runner = manager.fundRunnerById(request.runnerId);

      if (!runner) {
        throw new ServerError(Status.NOT_FOUND, "Runner not found");
      }

      const jwt = await new SignJWT()
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("1h")
        .setIssuer(getConfigOption("JOBBER_NAME"))
        .setAudience(`runner:${request.runnerId}`)
        .sign(Uint8Array.from(""));

      return {
        jwt,
      };
    }),

    getPublicKeys(request, context) {
      throw new Error("Method not implemented.");
    },

    createRunner(request, context) {
      throw new Error("Method not implemented.");
    },

    getAction(request, context) {
      throw new Error("Method not implemented.");
    },

    getJobs(request, context) {
      throw new Error("Method not implemented.");
    },

    getRunners(request, context) {
      throw new Error("Method not implemented.");
    },

    getHttpTriggers(request, context) {
      throw new Error("Method not implemented.");
    },

    async *getMqttTriggers(request, context) {
      let count = 0;
      while (count < 10) {
        yield { id: `mqtt-trigger-${count}` };
        count++;
      }
    },

    getScheduleTriggers(request, context) {
      throw new Error("Method not implemented.");
    },

    getJob(request, context) {
      throw new Error("Method not implemented.");
    },

    getGatewayConfig(request, context) {
      throw new Error("Method not implemented.");
    },
  };
//

@singleton()
export class GrpcServer extends LoopBase {
  protected loopDuration = 1000;

  protected loopStarted = undefined;
  protected loopClosed = undefined;

  private server: Server | null = null;

  protected async loopStarting() {
    this.server = createServer({});

    this.server.add(GeneralManagementDefinition, generalManagementDefinition);

    await this.server.listen(
      `${getConfigOption("MANAGER_GRPC_BIND_ADDRESS")}:${getConfigOption(
        "MANAGER_GRPC_PORT"
      )}`
    );
  }

  protected async loopClosing() {
    await this.server?.shutdown();
  }

  protected async loopIteration() {}
}
