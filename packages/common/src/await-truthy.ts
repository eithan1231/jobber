import { timeout } from "./timeout.js";

/**
 * Awaits until the callback yields true
 */
export const awaitTruthy = async (
  callback: () => Promise<boolean>,
  timeoutMs: number = 30_000
) => {
  let startTime = Date.now();

  let index = 0;
  while (true) {
    if (Date.now() - startTime > timeoutMs) {
      return false;
    }

    if (await callback()) {
      return true;
    }

    index++;

    if (index <= 10) {
      await timeout(10);
    }

    if (index > 10 && index <= 20) {
      await timeout(20);
    }

    if (index > 20) {
      await timeout(100);
    }
  }
};
