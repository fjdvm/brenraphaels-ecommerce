ALTER TABLE "orders" ADD COLUMN "paid_by_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "paid_by_name" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "paid_at" timestamp with time zone;