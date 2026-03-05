import { eq } from "drizzle-orm";
import { getDrizzle } from "./index.js";
import {
  OauthServiceClientTableInsertType,
  OauthServiceClientTableType,
} from "./types.js";
import { oauthServiceClientTable } from "./schema.js";

async function byId(id: string) {
  const serviceClient = await getDrizzle()
    .select()
    .from(oauthServiceClientTable)
    .where(eq(oauthServiceClientTable.id, id))
    .limit(1)
    .then((res) => res.at(0));

  return serviceClient;
}

async function byEnabled() {
  const serviceClients = await getDrizzle()
    .select()
    .from(oauthServiceClientTable)
    .where(eq(oauthServiceClientTable.enabled, true));
  return serviceClients;
}

async function byClientId(clientId: string) {
  const serviceClient = await getDrizzle()
    .select()
    .from(oauthServiceClientTable)
    .where(eq(oauthServiceClientTable.clientId, clientId))
    .limit(1)
    .then((res) => res.at(0));

  return serviceClient;
}

async function upsert(serviceClient: OauthServiceClientTableInsertType) {
  const createdServiceClient = await getDrizzle()
    .insert(oauthServiceClientTable)
    .values(serviceClient)
    .onConflictDoUpdate({
      target: oauthServiceClientTable.clientId,
      set: {
        name: serviceClient.name,
        description: serviceClient.description,
        allowedAudiences: serviceClient.allowedAudiences,
        allowedScopes: serviceClient.allowedScopes,
        enabled: serviceClient.enabled,
        expiresAt: serviceClient.expiresAt,
        isSystemManaged: serviceClient.isSystemManaged,
        permissions: serviceClient.permissions,
        metadata: serviceClient.metadata,
      },
    })
    .returning()
    .then((res) => res.at(0));

  return createdServiceClient;
}

async function all() {
  const serviceClients = await getDrizzle()
    .select()
    .from(oauthServiceClientTable);
  return serviceClients;
}

export const oauthServiceClientModel = {
  byId,
  byEnabled,
  byClientId,
  all,
  upsert,
};
