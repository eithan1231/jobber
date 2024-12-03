/**
 * Lifecycle:
 * 1) neutral = = default state (pre-start or stopped)
 * 2) starting = in process of starting
 * 3) started = active and running
 * 4) stopping = in process of stopping
 * 5) One stopped, goes to neutral.
 */
export type StatusLifecycle = "neutral" | "starting" | "started" | "stopping";
