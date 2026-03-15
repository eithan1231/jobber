import { z, ZodOptional, ZodType } from "zod";

export type Seed<
  TName extends string = string,
  TPayload extends ZodType = ZodType,
> = {
  name: TName;
  payload: TPayload;
  handler: (payload: unknown) => Promise<void>;
};

export function defineSeed<
  TName extends string,
  TPayload extends ZodType,
>(seed: {
  name: TName;
  payload: TPayload;
  handler: (payload: z.infer<TPayload>) => Promise<void>;
}): Seed<TName, TPayload> {
  return seed;
}

export type SeedSchemaMap<T extends readonly Seed[]> = {
  [K in T[number] as K["name"]]: K["payload"];
};
