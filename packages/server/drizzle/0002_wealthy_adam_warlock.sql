ALTER TABLE "logs" ADD COLUMN "created_temp" timestamp;
UPDATE "logs" SET "created_temp" = to_timestamp("created");
ALTER TABLE "logs" DROP COLUMN "created";
ALTER TABLE "logs" RENAME COLUMN "created_temp" TO "created";
ALTER TABLE "logs" ALTER COLUMN "created" SET DEFAULT now();