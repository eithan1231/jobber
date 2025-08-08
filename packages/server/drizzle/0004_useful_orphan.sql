CREATE TABLE "apiTokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" varchar NOT NULL,
	"userId" uuid NOT NULL,
	"permissions" jsonb NOT NULL,
	"expires" timestamp NOT NULL,
	"created" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "apiTokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" varchar(50) NOT NULL,
	"userId" uuid NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"expires" timestamp NOT NULL,
	"created" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar NOT NULL,
	"password" text NOT NULL,
	"permissions" jsonb NOT NULL,
	"created" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "apiTokens" ADD CONSTRAINT "apiTokens_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "usernameUniqueIndex" ON "users" USING btree (lower("username"));