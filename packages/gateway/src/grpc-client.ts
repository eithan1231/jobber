import { GeneralManagementDefinition } from "@jobber/grpc/server.js";

import {
  Channel,
  createChannel,
  createClientFactory,
  Metadata,
  RawClient,
} from "nice-grpc";
import { singleton, container } from "tsyringe";
import { FromTsProtoServiceDefinition } from "nice-grpc/lib/service-definitions/ts-proto.js";
import { LoopBase } from "@jobber/common";

@singleton()
export class GrpcClient extends LoopBase {
  protected loopDuration = 1_000;

  protected loopStarted = undefined;
  protected loopClosed = undefined;

  protected async loopIteration() {}

  private grpcChannel: Channel | null = null;

  private grpcClient: RawClient<
    FromTsProtoServiceDefinition<GeneralManagementDefinition>
  > | null = null;

  protected async loopStarting() {
    this.grpcChannel = createChannel("");

    this.grpcClient = createClientFactory().create(
      GeneralManagementDefinition,
      this.grpcChannel
    );
  }

  protected async loopClosing() {
    this.grpcChannel?.close();
    this.grpcChannel = null;
    this.grpcClient = null;
  }

  public get client() {
    if (!this.grpcClient) {
      throw new Error("GrpcClient not started");
    }

    return this.grpcClient;
  }
}

export const getGrpcClient = () => {
  return container.resolve(GrpcClient);
};
