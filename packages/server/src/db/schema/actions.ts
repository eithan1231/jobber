import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { getDefaultRuntimeImages } from "~/jobber/images.js";
import { jobVersionsTable } from "./job-versions.js";
import { jobsTable } from "./jobs.js";
import { z } from "zod";

export const ActionsDockerArgumentsSchema = z.object({
  networks: z.string().array().optional(),

  volumes: z
    .object({
      source: z.string(),
      target: z.string(),
      mode: z.enum(["rw", "ro"]).default("rw"),
    })
    .array()
    .optional(),

  labels: z
    .object({
      key: z.string().regex(/^[a-zA-Z0-9._-]+$/),
      value: z.string().regex(/^[a-zA-Z0-9._-]+$/),
    })
    .array()
    .optional(),

  memoryLimit: z
    .string()
    .regex(/^\d+[bkmg]$/)
    .optional(),

  directPassthroughArguments: z.string().array().optional(),
});

export type ActionsDockerArgumentsSchemaType = z.infer<
  typeof ActionsDockerArgumentsSchema
>;

export const actionsTable = pgTable("actions", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  jobId: uuid()
    .notNull()
    .references(() => jobsTable.id, { onDelete: "cascade" }),
  jobVersionId: uuid()
    .notNull()
    .references(() => jobVersionsTable.id, { onDelete: "cascade" }),
  runnerImage: text().notNull().default(getDefaultRuntimeImages().node),
  runnerAsynchronous: boolean().default(true).notNull(),
  runnerMinCount: integer().default(1).notNull(),
  runnerMaxCount: integer().default(16).notNull(),
  runnerTimeout: integer().default(60).notNull(),
  runnerMaxAge: integer().default(900).notNull(),
  runnerMaxAgeHard: integer().default(960).notNull(),
  runnerDockerArguments: jsonb()
    .$type<ActionsDockerArgumentsSchemaType>()
    .notNull()
    .default({}),
  runnerMode: text({
    enum: ["standard", "run-once"],
  }).default("standard"),
});

export type ActionsTableType = typeof actionsTable.$inferSelect;
