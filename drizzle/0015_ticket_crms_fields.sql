ALTER TABLE "tickets" ALTER COLUMN "status" SET DEFAULT 'open';--> statement-breakpoint
ALTER TABLE "ticket_messages" ADD COLUMN "file_id" text;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "priority" text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "claimed_by_id" text;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "claimed_by_name" text;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "resolved_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "tickets" SET "status" = 'completed' WHERE "status" = 'closed';
