/**
 * Creates a promise that resolves after a timeout
 * @param ms Time to wait in milliseconds
 * @returns
 */
export const timeout = (ms: number, signal?: AbortSignal) => {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      return resolve();
    }

    const resolver = () => {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", resolver);

      resolve();
    };

    const timeoutId = setTimeout(() => {
      resolver();
    }, ms);

    signal?.addEventListener("abort", () => {
      resolver();
    });
  });
};
