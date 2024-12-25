ALTER TABLE "logs" DROP CONSTRAINT "logs_jobId_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "logs" DROP CONSTRAINT "logs_actionId_actions_id_fk";
--> statement-breakpoint
ALTER TABLE "logs" ALTER COLUMN "jobId" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "logs" ALTER COLUMN "actionId" SET NOT NULL;