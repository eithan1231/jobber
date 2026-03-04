import { getConfigOption } from "./config.js";
import { createRemoteJWKSet, decodeJwt } from "jose";

function getDiscoveryUrl(): string {
  if (getConfigOption("OIDC_DISCOVERY_URL")) {
    return getConfigOption("OIDC_DISCOVERY_URL")!;
  }

  const issuerUrl = getConfigOption("OIDC_ISSUER_URL");

  return `${issuerUrl.replace(/\/+$/, "")}/.well-known/openid-configuration`;
}

async function getOAuthDiscovery() {
  const response = await fetch(getDiscoveryUrl());

  if (!response.ok) {
    throw new Error(
      `Failed to fetch OIDC discovery document: ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as {
    issuer: string;
    token_endpoint: string;
    jwks_uri: string;
    token_endpoint_auth_methods_supported: string[];
  };
}

async function getRemoteJwks() {
  const discovery = await getOAuthDiscovery();

  return createRemoteJWKSet(new URL(discovery.jwks_uri), {
    cacheMaxAge: 5 * 60 * 1000,
  });
}

export async function createOauth2Token(audience: string) {
  const discovery = await getOAuthDiscovery();

  if (
    !discovery.token_endpoint_auth_methods_supported.includes(
      "client_secret_basic",
    )
  ) {
    throw new Error(
      "OIDC provider does not support client_secret_basic authentication",
    );
  }

  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");
  params.append("client_id", getConfigOption("OAUTH_CLIENT_ID"));
  params.append("client_secret", getConfigOption("OAUTH_CLIENT_SECRET"));
  params.append("audience", audience);

  const response = await fetch(discovery.token_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch OIDC token: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();

  if (typeof data.access_token !== "string") {
    throw new Error("OIDC token response does not contain access_token");
  }

  if (!data.token_type || data.token_type.toLowerCase() !== "bearer") {
    throw new Error("OIDC token response does not contain bearer token");
  }

  const decoded = decodeJwt(data.access_token);

  if (!decoded.exp) {
    throw new Error("OIDC token does not contain exp claim");
  }

  return {
    token: data.access_token,
    expiresAt: decoded.exp,
    refreshAt: decoded.exp - 60,
  };
}

// const oauth2TokenCache = new Map<
//   string,
//   { token: string; expiresAt: number }
// >();

// // TODO: this whole file sucks, rewrite it. And make it reusable for the runner, probs
// // needs to go into the common package.
// export async function getOauth2Token(audience: string) {
//   const cached = oauth2TokenCache.get(audience);

//   if (cached && cached.expiresAt > Date.now() + 60 * 1000) {
//     return cached.token;
//   }

//   const token = await createOauth2Token(audience);

//   const payload = decodeJwt(token);

//   if (!payload.exp) {
//     throw new Error("OIDC token does not contain exp claim");
//   }

//   oauth2TokenCache.set(audience, {
//     token,
//     expiresAt: payload.exp * 1000,
//   });

//   return token;
// }
