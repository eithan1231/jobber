import { eq } from "drizzle-orm";
import { getDrizzle } from "./index.js";
import {
  oauthServiceClientTable,
  OauthServiceClientTableInsertType,
} from "./schema/oauth-service-client.js";

async function byId(id: string) {
  const serviceClient = await getDrizzle()
    .select()
    .from(oauthServiceClientTable)
    .where(eq(oauthServiceClientTable.id, id))
    .limit(1)
    .then((res) => res.at(0));

  return serviceClient;
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

async function create(serviceClient: OauthServiceClientTableInsertType) {
  const createdServiceClient = await getDrizzle()
    .insert(oauthServiceClientTable)
    .values(serviceClient)
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
  byClientId,
  all,
  create,
};
