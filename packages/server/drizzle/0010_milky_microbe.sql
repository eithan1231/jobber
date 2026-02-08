CREATE TABLE "auditLog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject" jsonb NOT NULL,
	"entry" jsonb NOT NULL,
	"created" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauthServiceClient" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"is_system_managed" boolean DEFAULT false NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"clientId" varchar(255) NOT NULL,
	"metadata" jsonb NOT NULL,
	"allowedAudiences" jsonb NOT NULL,
	"allowedScopes" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"expiresAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauthSigningKey" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"child_id" uuid,
	"created_by_user_id" uuid,
	"status" varchar(255) NOT NULL,
	"alg" varchar(255) NOT NULL,
	"use" varchar(255) NOT NULL,
	"private_key_encrypted" text NOT NULL,
	"public_key" text NOT NULL,
	"expiresAt" timestamp,
	"renewsAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "actions" ALTER COLUMN "runnerImage" SET DEFAULT 'node24';--> statement-breakpoint
ALTER TABLE "oauthSigningKey" ADD CONSTRAINT "oauthSigningKey_parent_id_oauthSigningKey_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."oauthSigningKey"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauthSigningKey" ADD CONSTRAINT "oauthSigningKey_child_id_oauthSigningKey_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."oauthSigningKey"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauthSigningKey" ADD CONSTRAINT "oauthSigningKey_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;