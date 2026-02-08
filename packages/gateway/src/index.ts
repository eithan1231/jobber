import { container } from "tsyringe";
import { getGrpcClient } from "./grpc-client.js";
import { GatewayClient } from "./gateway.js";

async function main() {
  console.log("Starting Gateway Management Client...");

  console.log("Starting gRPC Client...");
  const grpc = getGrpcClient();
  await grpc.start();
  console.log("started");

  console.log("Starting Gateway...");
  const gateway = container.resolve(GatewayClient);
  await gateway.start();
  console.log("Gateway Management Client started");

  process.once("SIGINT", async () => {
    console.log("Stopping Gateway...");
    await gateway.stop();
    console.log("stopped");

    console.log("Stopping gRPC Client...");
    await grpc.stop();
    console.log("stopped");

    process.exit(0);
  });
}

main();
