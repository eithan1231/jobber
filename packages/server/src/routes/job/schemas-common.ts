import { z } from "zod";

export const jobNameSchema = z.string().min(1).max(128);
export const jobEnvironmentNameSchema = z
  .string()
  .min(1)
  .max(128)
  .toUpperCase();
