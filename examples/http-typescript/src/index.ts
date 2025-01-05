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

  const count = await context.getStoreJson<StoreCounter>(storeKeyCount);

  await context.setStoreJson<StoreCounter>(storeKeyCount, (count ?? 0) + 1);

  return response.json(
    {
      count,
    },
    200
  );
};
