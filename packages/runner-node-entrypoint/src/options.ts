export type RunnerOptions = {
  runnerId: string;
  runnerClientId: string;
  runnerClientSecret: string;
  runnerGeneralApiEndpoint: string;

  runnerOAuthTokenEndpoint: string;
  runnerOAuthJwksEndpoint: string;
  runnerOAuthIssuer: string;

  runnerApiPort: number;

  runnerDebug: boolean;
};

export function getArgument(name: string) {
  const arg = process.argv.find((arg) => arg.startsWith(`--${name}=`));

  if (!arg) {
    return null;
  }

  return arg.split("=", 2)[1];
}

function getOptionsFromArgs(): RunnerOptions | null {
  const runnerId = getArgument("runner-id");
  const runnerClientId = getArgument("client-id");
  const runnerClientSecret = getArgument("client-secret");
  const runnerGeneralApiEndpoint = getArgument("general-api-endpoint");
  const runnerOAuthTokenEndpoint = getArgument("oauth-token-endpoint");
  const runnerOAuthJwksEndpoint = getArgument("oauth-jwks-endpoint");
  const runnerOAuthIssuer = getArgument("oauth-issuer");
  const runnerApiPort = Number(getArgument("port"));

  const runnerDebug = getArgument("debug");

  if (
    runnerId === null ||
    runnerClientId === null ||
    runnerClientSecret === null ||
    runnerGeneralApiEndpoint === null ||
    runnerOAuthTokenEndpoint === null ||
    runnerOAuthJwksEndpoint === null ||
    runnerOAuthIssuer === null ||
    isNaN(runnerApiPort) ||
    runnerDebug === null
  ) {
    return null;
  }

  const runnerDebugParsed = runnerDebug
    ? ["true", "yes", "ok", "y"].includes(runnerDebug.toLowerCase())
    : false;

  return {
    runnerId,
    runnerClientId,
    runnerClientSecret,
    runnerGeneralApiEndpoint,
    runnerOAuthTokenEndpoint,
    runnerOAuthJwksEndpoint,
    runnerOAuthIssuer,
    runnerApiPort,
    runnerDebug: runnerDebugParsed,
  };
}

function getOptionsFromEnv(): RunnerOptions | null {
  const runnerId = process.env.RUNNER_ID;
  const runnerClientId = process.env.RUNNER_CLIENT_ID;
  const runnerClientSecret = process.env.RUNNER_CLIENT_SECRET;
  const runnerGeneralApiEndpoint = process.env.RUNNER_GENERAL_API_ENDPOINT;
  const runnerOAuthTokenEndpoint = process.env.RUNNER_OAUTH_TOKEN_ENDPOINT;
  const runnerOAuthJwksEndpoint = process.env.RUNNER_OAUTH_JWKS_ENDPOINT;
  const runnerOAuthIssuer = process.env.RUNNER_OAUTH_ISSUER;
  const runnerApiPort = Number(process.env.RUNNER_API_PORT);
  const runnerDebug = process.env.RUNNER_DEBUG;

  if (
    !runnerId ||
    !runnerClientId ||
    !runnerClientSecret ||
    !runnerGeneralApiEndpoint ||
    !runnerOAuthTokenEndpoint ||
    !runnerOAuthJwksEndpoint ||
    !runnerOAuthIssuer ||
    isNaN(runnerApiPort)
  ) {
    return null;
  }

  const runnerDebugParsed = runnerDebug
    ? ["true", "yes", "ok", "y"].includes(runnerDebug.toLowerCase())
    : false;

  return {
    runnerId,
    runnerClientId,
    runnerClientSecret,
    runnerGeneralApiEndpoint,
    runnerOAuthTokenEndpoint,
    runnerOAuthJwksEndpoint,
    runnerOAuthIssuer,
    runnerApiPort,
    runnerDebug: runnerDebugParsed,
  };
}

export function getOptions(): RunnerOptions {
  const fromArgs = getOptionsFromArgs();
  if (fromArgs) {
    return fromArgs;
  }

  const fromEnv = getOptionsFromEnv();
  if (fromEnv) {
    return fromEnv;
  }

  throw new Error(
    "Failed to get options from arguments or environment variables. Please provide the necessary configuration.",
  );
}
