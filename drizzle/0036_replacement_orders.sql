ALTER TABLE "orders" ADD COLUMN "refund_window_extended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refund_window_extension_reason" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refund_window_extended_by_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refund_window_extended_by_name" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "replacement_for_order_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "replacement_for_return_id" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "orders_replacement_for_return" ON "orders" USING btree ("replacement_for_return_id");