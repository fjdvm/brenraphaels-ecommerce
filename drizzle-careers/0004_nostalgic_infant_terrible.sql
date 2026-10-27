CREATE TABLE "job_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"department" text NOT NULL,
	"description" text NOT NULL,
	"requirements" text NOT NULL,
	"employment_type" text NOT NULL,
	"location" text NOT NULL,
	"required_documents" jsonb NOT NULL,
	"screening_criteria" jsonb NOT NULL,
	"status" text NOT NULL,
	"announced_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "announced_at" timestamp with time zone;