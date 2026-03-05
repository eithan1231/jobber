import "reflect-metadata";
import { GatewayClient } from "./gateway.js";

async function main() {
  console.log("Starting Gateway Management Client...");

  console.log("Starting Gateway...");
  const gateway = new GatewayClient();
  await gateway.start();
  console.log("Gateway Management Client started");

  const shutdown = async () => {
    console.log("Stopping Gateway...");
    await gateway.stop();
    console.log("stopped");

    process.exit(0);
  };

  process.once("SIGTERM", async () => {
    await shutdown();
  });
  process.once("SIGINT", async () => {
    await shutdown();
  });
}

main();
