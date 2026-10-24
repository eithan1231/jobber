import { z } from "zod";

export const jobNameSchema = z.string().min(1).max(128);
// Runner IDs are `<prefix>-<64 hex characters>`, see RunnerManager.createRunner.
export const runnerIdSchema = z
  .string()
  .max(128)
  .regex(/^[0-9a-z_-]+-[0-9a-f]{64}$/i);

export const jobEnvironmentNameSchema = z
  .string()
  .min(1)
  .max(128)
  .toUpperCase();
