ALTER TABLE "orders" ADD COLUMN "packing_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "packed_by_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "packed_by_name" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "packed_at" timestamp with time zone;