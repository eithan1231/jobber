/**
 * Creates a promise that resolves after a timeout
 * @param ms Time to wait in milliseconds
 * @returns
 */
export const timeout = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
