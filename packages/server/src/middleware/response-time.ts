import { Context, Next } from "hono";
import { timeout } from "~/util.js";

export function createMiddlewareResponseTime(duration: number) {
  return async (c: Context, next: Next) => {
    const start = Date.now();

    await next();

    const end = Date.now();

    const remainingTime = duration - (end - start);

    if (remainingTime > 0) {
      await timeout(remainingTime);
    }

    return c;
  };
}
