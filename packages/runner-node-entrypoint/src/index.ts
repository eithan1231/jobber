import { Runner } from "./runner.js";
import { getArgument } from "./util.js";

const main = async () => {
  const runnerId = getArgument("runner-id");
  const runnerClientId = getArgument("client-id");
  const runnerClientSecret = getArgument("client-secret");
  const runnerGeneralApiEndpoint = getArgument("general-api-endpoint");
  const runnerOAuthTokenEndpoint = getArgument("oauth-token-endpoint");
  const runnerOAuthJwksEndpoint = getArgument("oauth-jwks-endpoint");
  const runnerOAuthIssuer = getArgument("oauth-issuer");
  const runnerApiPort = Number(getArgument("port"));

  const runnerDebug = ["true", "yes", "ok", "y"].includes(
    getArgument("debug").toLowerCase(),
  );

  if (runnerDebug) {
    console.log("[main] Starting runner with the following configuration:");
    console.log(`  Runner Identifier: ${runnerId}`);
    console.log(`  Runner Client ID: ${runnerClientId}`);
    console.log(
      `  Runner Client Secret: ${"*".repeat(runnerClientSecret.length)}`,
    );
    console.log(`  Runner General API: ${runnerGeneralApiEndpoint}`);
    console.log(`  Runner Debug Mode: ${runnerDebug ? "Enabled" : "Disabled"}`);
  }

  const runner = new Runner({
    runnerId,
    runnerClientId,
    runnerClientSecret,
    runnerGeneralApiEndpoint,

    runnerOAuthTokenEndpoint,
    runnerOAuthJwksEndpoint,
    runnerOAuthIssuer,

    runnerApiPort,

    runnerDebug,
  });

  await runner.start();

  const shutdown = async () => {
    await runner.stop();

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
