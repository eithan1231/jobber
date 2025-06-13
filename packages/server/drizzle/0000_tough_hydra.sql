CREATE TABLE "actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jobId" uuid NOT NULL,
	"jobVersionId" uuid NOT NULL,
	"runnerImage" text DEFAULT 'node22' NOT NULL,
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
CREATE TABLE "job-versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jobId" uuid NOT NULL,
	"version" varchar(32) NOT NULL,
	"modified" integer NOT NULL,
	"created" integer NOT NULL,
	CONSTRAINT "job-versions_jobId_version_unique" UNIQUE("jobId","version")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jobName" varchar(128) NOT NULL,
	"description" text,
	"jobVersionId" uuid,
	"status" varchar(16) DEFAULT 'enabled',
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "jobs_jobName_unique" UNIQUE("jobName")
);
--> statement-breakpoint
CREATE TABLE "logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jobId" uuid NOT NULL,
	"actionId" uuid NOT NULL,
	"source" varchar NOT NULL,
	"created" integer NOT NULL,
	"message" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jobId" uuid NOT NULL,
	"storeKey" varchar(128) NOT NULL,
	"storeValue" text NOT NULL,
	"expiry" integer,
	"modified" integer NOT NULL,
	"created" integer NOT NULL,
	CONSTRAINT "store_jobId_storeKey_unique" UNIQUE("jobId","storeKey")
);
--> statement-breakpoint
CREATE TABLE "triggers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jobId" uuid NOT NULL,
	"jobVersionId" uuid NOT NULL,
	"context" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_jobId_jobs_id_fk" FOREIGN KEY ("jobId") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_jobVersionId_job-versions_id_fk" FOREIGN KEY ("jobVersionId") REFERENCES "public"."job-versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environments" ADD CONSTRAINT "environments_jobId_jobs_id_fk" FOREIGN KEY ("jobId") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job-versions" ADD CONSTRAINT "job-versions_jobId_jobs_id_fk" FOREIGN KEY ("jobId") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_jobVersionId_job-versions_id_fk" FOREIGN KEY ("jobVersionId") REFERENCES "public"."job-versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store" ADD CONSTRAINT "store_jobId_jobs_id_fk" FOREIGN KEY ("jobId") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "triggers" ADD CONSTRAINT "triggers_jobId_jobs_id_fk" FOREIGN KEY ("jobId") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "triggers" ADD CONSTRAINT "triggers_jobVersionId_job-versions_id_fk" FOREIGN KEY ("jobVersionId") REFERENCES "public"."job-versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jobId_created_idx" ON "logs" USING btree ("jobId","created");