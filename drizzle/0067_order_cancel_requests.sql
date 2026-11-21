CREATE TABLE "order_cancel_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"requested_by_id" text NOT NULL,
	"requested_by_name" text NOT NULL,
	"decided_by_id" text,
	"decided_by_name" text,
	"decline_reason" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_cancel_requests_status" CHECK ("order_cancel_requests"."status" in ('waiting', 'approved', 'declined', 'withdrawn'))
);
--> statement-breakpoint
ALTER TABLE "order_cancel_requests" ADD CONSTRAINT "order_cancel_requests_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "order_cancel_requests_open" ON "order_cancel_requests" USING btree ("order_id") WHERE "order_cancel_requests"."status" = 'waiting';--> statement-breakpoint
CREATE INDEX "order_cancel_requests_order" ON "order_cancel_requests" USING btree ("order_id");
