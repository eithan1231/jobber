import { pgTable, varchar, uuid, text, jsonb } from "drizzle-orm/pg-core";

export const jobsTable = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  jobName: varchar({ length: 128 }).unique().notNull(),
  description: text(),
  version: varchar({ length: 16 }),

  status: varchar({
    enum: ["enabled", "disabled"],
    length: 16,
  }).default("enabled"),

  links: jsonb()
    .$type<
      Array<{
        name: string;
        url: string;
      }>
    >()
    .notNull()
    .default([]),
});

export type JobsTableType = typeof jobsTable.$inferSelect;
