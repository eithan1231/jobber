CREATE TABLE "store" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jobId" uuid NOT NULL,
	"storeKey" varchar(128) NOT NULL,
	"storeValue" text NOT NULL,
	"expiry" integer,
	"modified" integer NOT NULL,
	"created" integer NOT NULL,
	CONSTRAINT "store_jobId_unique" UNIQUE("jobId")
);
--> statement-breakpoint
ALTER TABLE "store" ADD CONSTRAINT "store_jobId_jobs_id_fk" FOREIGN KEY ("jobId") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;