const storeKeyCount = "KEY";

type StoreCounter = number;

export const handler = async (
  request: JobberHandlerRequest,
  response: JobberHandlerResponse,
  context: JobberHandlerContext
) => {
  if (request.type() !== "http") {
    throw new Error("Expecting HTTP request");
  }

  await context.setStoreJson(
    "medium-length",
    "SDGFDHGUDGGUSDGFDHGUDGGUSDGFDHGUDGGU"
  );
  await context.setStoreJson(
    "long-length-sdfhkfgasufygasiuyfgweuofygweoyfvewifyvewrifygverygifvegerg",
    "SDGFDHGUDGGUSDGFDHGUDGGUSDGFDHGUDGGUSDGFDHGUDGGUSDGFDHGUDGGUSDGFDHGUDGGUSDGFDHGUDGGUSDGFDHGUDGGUSDGFDHGUDGGUSDGFDHGUDGGUSDGFDHGUDGGUSDGFDHGUDGGU"
  );

  await context.setStoreJson("1d expiry", "", {
    ttl: 60 * 60 * 24, // 1 day
  });

  await context.setStoreJson("5h expiry", "", {
    ttl: 60 * 60 * 5, // 5 hours
  });

  await context.setStoreJson("1m expiry", "", {
    ttl: 60, // 1m
  });

  await context.setStoreJson("5m expiry", "", {
    ttl: 60 * 5, // 5 minutes
  });

  const count = await context.getStoreJson<StoreCounter>(storeKeyCount);

  await context.setStoreJson<StoreCounter>(storeKeyCount, (count ?? 0) + 1);

  return response.json(
    {
      count,
    },
    200
  );
};
