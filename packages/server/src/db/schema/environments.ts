import { integer, jsonb, pgTable, uuid } from "drizzle-orm/pg-core";
import { z } from "zod";
import { jobsTable } from "./jobs.js";

export const EnvironmentsContextSchema = z.record(
  z.string(),
  z.object({
    value: z.string(),
    type: z.enum(["secret", "text"]),
  })
);

export type EnvironmentsContextSchemaType = z.infer<
  typeof EnvironmentsContextSchema
>;

export const environmentsTable = pgTable("environments", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  jobId: uuid()
    .unique()
    .notNull()
    .references(() => jobsTable.id, { onDelete: "cascade" }),

  context: jsonb().$type<EnvironmentsContextSchemaType>().notNull().default({}),

  modified: integer().notNull(),
});

export type EnvironmentsTableType = typeof environmentsTable.$inferSelect;
