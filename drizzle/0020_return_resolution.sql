ALTER TABLE "order_returns" DROP CONSTRAINT "order_returns_status";--> statement-breakpoint
ALTER TABLE "order_returns" ADD COLUMN "preferred_resolution" text DEFAULT 'refund' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_returns" ADD COLUMN "final_resolution" text;--> statement-breakpoint
ALTER TABLE "order_returns" ADD COLUMN "video_file_id" text;--> statement-breakpoint
ALTER TABLE "order_returns" ADD COLUMN "refund_proof_file_id" text;--> statement-breakpoint
ALTER TABLE "order_returns" ADD COLUMN "replaced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order_return_history" ADD CONSTRAINT "order_return_history_status" CHECK ("order_return_history"."status" in ('requested','approved','goods received','refunded','replaced','declined','cancelled'));--> statement-breakpoint
ALTER TABLE "order_returns" ADD CONSTRAINT "order_returns_preferred_resolution" CHECK ("order_returns"."preferred_resolution" in ('refund','replacement'));--> statement-breakpoint
ALTER TABLE "order_returns" ADD CONSTRAINT "order_returns_final_resolution" CHECK ("order_returns"."final_resolution" in ('refund','replacement'));--> statement-breakpoint
ALTER TABLE "order_returns" ADD CONSTRAINT "order_returns_status" CHECK ("order_returns"."status" in ('requested','approved','goods received','refunded','replaced','declined','cancelled'));
--> statement-breakpoint
-- Before Resolution existed, all approved/completed Returns were refunds.
UPDATE "order_returns" SET "final_resolution" = 'refund' WHERE "status" IN ('approved', 'goods received', 'refunded');
