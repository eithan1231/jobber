ALTER TABLE "runners" ADD COLUMN "status" varchar(50);
UPDATE "runners" SET "status" = 'closed' WHERE "status" IS NULL;
ALTER TABLE "runners" ALTER COLUMN "status" SET NOT NULL;