ALTER TABLE "order_email_outcomes" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "order_email_outcomes" ADD COLUMN "next_attempt_at" timestamp with time zone;