import { REGEX_ALPHA_NUMERIC_DASHES } from "./constants.js";

export const getUnixTimestamp = () => Math.round(Date.now() / 1000);

export const timeout = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

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

    if (index++ > 30) {
      await timeout(100);
    } else {
      await timeout(20);
    }
  }
};

export const sanitiseFilename = (filename: string) => {
  return filename.replaceAll(/[^0-9a-z-_ ]/gi, "");
};
