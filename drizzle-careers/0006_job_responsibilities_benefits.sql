ALTER TABLE "job_postings" ADD COLUMN "responsibilities" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "benefits" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "job_templates" ADD COLUMN "responsibilities" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "job_templates" ADD COLUMN "benefits" jsonb DEFAULT '[]'::jsonb NOT NULL;