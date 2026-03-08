import { BouncerBase } from "@jobber/common/bouncer-base.js";
import { getOAuthAudienceGeneralApi } from "@jobber/common/oauth.js";
import { JobberPermissionsSchema } from "@jobber/common/permissions.js";
import { createLocalJWKSet, errors as joseErrors, jwtVerify } from "jose";
import { CallContext, ServerError, Status } from "nice-grpc";
import { container } from "tsyringe";
import { getConfigOption } from "~/config.js";
import { OAuthServiceClients } from "~/service-clients.js";
import { OAuthSigningKeys } from "~/signing-keys.js";

export const authorizedCall = <TRequest, TResponse>(
  callback: (
    request: TRequest,
    context: CallContext,
    bouncer: BouncerBase,
  ) => Promise<TResponse>,
) => {
  return async (
    request: TRequest,
    context: CallContext,
  ): Promise<TResponse> => {
    return callback(request, context, await getBouncer(context));
  };
};

export const getBouncer = async (context: CallContext) => {
  try {
    const oauthSigningKeys = container.resolve(OAuthSigningKeys);

    let token = context.metadata.get("Authorization");

    if (!token) {
      console.log("gRPC Unauthorized error: No token provided");
      throw new ServerError(Status.UNAUTHENTICATED, "Unauthenticated");
    }

    if (token.startsWith("Bearer ")) {
      token = token.slice("Bearer ".length);
    }

    const jwks = createLocalJWKSet(await oauthSigningKeys.createJwksSet());

    const { payload } = await jwtVerify(token, jwks, {
      issuer: getConfigOption("OAUTH_ISSUER"),
      audience: getOAuthAudienceGeneralApi(),
    });

    const permissions = await JobberPermissionsSchema.parseAsync(
      payload.permissions,
    );

    const bouncer = new BouncerBase(permissions);

    return bouncer;
  } catch (err) {
    if (err instanceof ServerError) {
      throw err;
    }

    if (err instanceof joseErrors.JOSEError) {
      console.log("gRPC Unauthorized error:", err);
      throw new ServerError(Status.UNAUTHENTICATED, "Unauthenticated");
    }

    console.log("gRPC Internal server error:", err);
    throw new ServerError(Status.INTERNAL, "Internal server error");
  }
};
