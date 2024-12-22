CREATE TABLE "actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jobId" uuid NOT NULL,
	"version" varchar(16) NOT NULL,
	"runnerAsynchronous" boolean DEFAULT true NOT NULL,
	"runnerMinCount" integer DEFAULT 1 NOT NULL,
	"runnerMaxCount" integer DEFAULT 16 NOT NULL,
	"runnerTimeout" integer DEFAULT 60 NOT NULL,
	"runnerMaxAge" integer DEFAULT 900 NOT NULL,
	"runnerMaxAgeHard" integer DEFAULT 960 NOT NULL,
	"runnerMode" text DEFAULT 'standard'
);
--> statement-breakpoint
CREATE TABLE "environments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jobId" uuid NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"modified" integer NOT NULL,
	CONSTRAINT "environments_jobId_unique" UNIQUE("jobId")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jobName" varchar(128) NOT NULL,
	"description" text,
	"version" varchar(16),
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "jobs_jobName_unique" UNIQUE("jobName")
);
--> statement-breakpoint
CREATE TABLE "logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jobId" uuid,
	"actionId" uuid,
	"source" varchar NOT NULL,
	"created" integer NOT NULL,
	"message" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "triggers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jobId" uuid NOT NULL,
	"version" varchar(16) NOT NULL,
	"context" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_jobId_jobs_id_fk" FOREIGN KEY ("jobId") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environments" ADD CONSTRAINT "environments_jobId_jobs_id_fk" FOREIGN KEY ("jobId") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logs" ADD CONSTRAINT "logs_jobId_jobs_id_fk" FOREIGN KEY ("jobId") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logs" ADD CONSTRAINT "logs_actionId_actions_id_fk" FOREIGN KEY ("actionId") REFERENCES "public"."actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "triggers" ADD CONSTRAINT "triggers_jobId_jobs_id_fk" FOREIGN KEY ("jobId") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;