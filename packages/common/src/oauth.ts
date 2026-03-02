export const getOAuthAudienceGeneralApi = () => {
  return "jobber-api";
};

export const getOAuthAudienceRunnerApi = (runnerId: string) => {
  return `jobber-runner:${runnerId}`;
};

export const getOAuthAudienceGatewayApi = () => {
  return "jobber-gateway";
};

/**
 * Checks whether a given audience matches any of the allowed audiences, supporting
 * wildcard segments using the `*` character, split by `:`.
 */
export const canOAuthAccessAudience = (
  audience: string,
  allowedAudiences: string[],
) => {
  const audienceChunks = audience.split(":");

  for (const allowedAudience of allowedAudiences) {
    const allowedAudienceChunks = allowedAudience.split(":");

    if (allowedAudienceChunks.length !== audienceChunks.length) {
      continue;
    }

    let matches = true;

    for (let i = 0; i < allowedAudienceChunks.length; i++) {
      if (
        allowedAudienceChunks[i] !== "*" &&
        allowedAudienceChunks[i] !== audienceChunks[i]
      ) {
        matches = false;
        break;
      }
    }

    if (matches) {
      return true;
    }
  }

  return false;
};
