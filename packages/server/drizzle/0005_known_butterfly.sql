CREATE TABLE "lock" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lockKey" varchar(256) NOT NULL,
	"expires" timestamp DEFAULT NOW() + INTERVAL '5 minutes' NOT NULL,
	"created" timestamp DEFAULT NOW() NOT NULL,
	"modified" timestamp DEFAULT NOW() NOT NULL,
	CONSTRAINT "lock_lockKey_unique" UNIQUE("lockKey")
);
--> statement-breakpoint
ALTER TABLE "apiTokens" ALTER COLUMN "token" SET DATA TYPE varchar(70);