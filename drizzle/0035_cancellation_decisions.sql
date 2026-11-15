ALTER TABLE "order_cancellations" ADD COLUMN "approval_status" text DEFAULT 'waiting-manager' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_cancellations" ADD COLUMN "decline_reason" text;