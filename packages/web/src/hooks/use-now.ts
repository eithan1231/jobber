import { useEffect, useState } from "react";

const getUnixTimestamp = () => Math.floor(Date.now() / 1000);

/**
 * The current unix timestamp in seconds, refreshed every `intervalMs`. Reading the clock during
 * render is impure, so components needing "now" should use this instead of `Date.now()`.
 */
export const useNow = (intervalMs = 1000) => {
  const [now, setNow] = useState(getUnixTimestamp);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(getUnixTimestamp());
    }, intervalMs);

    return () => clearInterval(interval);
  }, [intervalMs]);

  return now;
};
