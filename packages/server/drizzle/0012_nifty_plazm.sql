CREATE TABLE "runners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jobId" uuid NOT NULL,
	"jobVersionId" uuid NOT NULL,
	"actionId" uuid NOT NULL,
	"environmentId" uuid,
	"oauthServiceClientId" uuid,
	"properties" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"readyAt" timestamp,
	"closingAt" timestamp,
	"closedAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "runners" ADD CONSTRAINT "runners_jobId_jobs_id_fk" FOREIGN KEY ("jobId") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runners" ADD CONSTRAINT "runners_jobVersionId_job-versions_id_fk" FOREIGN KEY ("jobVersionId") REFERENCES "public"."job-versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runners" ADD CONSTRAINT "runners_actionId_actions_id_fk" FOREIGN KEY ("actionId") REFERENCES "public"."actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runners" ADD CONSTRAINT "runners_environmentId_environments_id_fk" FOREIGN KEY ("environmentId") REFERENCES "public"."environments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runners" ADD CONSTRAINT "runners_oauthServiceClientId_oauthServiceClient_id_fk" FOREIGN KEY ("oauthServiceClientId") REFERENCES "public"."oauthServiceClient"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauthServiceClient" ADD CONSTRAINT "oauthServiceClient_clientId_unique" UNIQUE("clientId");