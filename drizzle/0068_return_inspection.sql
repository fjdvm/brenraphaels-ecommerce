ALTER TABLE "order_return_items" ADD COLUMN "condition" text;--> statement-breakpoint
ALTER TABLE "order_return_items" ADD COLUMN "inspected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order_return_items" ADD COLUMN "inspected_by_id" text;--> statement-breakpoint
ALTER TABLE "order_return_items" ADD COLUMN "inspected_by_name" text;--> statement-breakpoint
ALTER TABLE "order_return_items" ADD COLUMN "inspection_id" text;--> statement-breakpoint
ALTER TABLE "order_return_items" ADD COLUMN "restocked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order_return_items" ADD COLUMN "written_off_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order_return_items" ADD CONSTRAINT "order_return_items_condition" CHECK ("order_return_items"."condition" in ('sellable', 'damaged'));
