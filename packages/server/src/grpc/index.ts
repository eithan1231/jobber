import { LoopBase } from "@jobber/common";
import { GeneralManagementDefinition } from "@jobber/grpc/server.js";
import { createServer, Server, ServiceImplementation } from "nice-grpc";
import { singleton } from "tsyringe";
import { getConfigOption } from "~/config.js";

const generalManagementDefinition: ServiceImplementation<GeneralManagementDefinition> =
  {
    createJwt(request, context) {
      throw new Error("Method not implemented.");
    },

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

    getMqttTriggers(request, context) {
      throw new Error("Method not implemented.");
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
