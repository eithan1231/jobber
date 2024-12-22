import { pgTable, uuid, jsonb, integer } from "drizzle-orm/pg-core";
import { jobsTable } from "./jobs.js";
import { z } from "zod";

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
