import { getOptions } from "./options.js";
import { Runner } from "./runner.js";

const main = async () => {
  const options = getOptions();

  if (options.runnerDebug) {
    console.log("[main] Starting runner with the following configuration:");
    console.log(`  Runner Identifier: ${options.runnerId}`);
    console.log(`  Runner Client ID: ${options.runnerClientId}`);
    console.log(
      `  Runner Client Secret: ${"*".repeat(options.runnerClientSecret.length)}`,
    );
    console.log(`  Runner General API: ${options.runnerGeneralApiEndpoint}`);
    console.log(
      `  Runner Debug Mode: ${options.runnerDebug ? "Enabled" : "Disabled"}`,
    );
  }

  const runner = new Runner(options);

  await runner.start();

  const shutdown = async () => {
    if (options.runnerDebug) {
      console.info("Shutdown procedure started...");
    }

    await runner.stop();

    if (options.runnerDebug) {
      console.info("Shutdown procedure completed");
    }

    process.exit(0);
  };

  process.once("SIGTERM", async () => {
    await shutdown();
  });
  process.once("SIGINT", async () => {
    await shutdown();
  });
};

main();
