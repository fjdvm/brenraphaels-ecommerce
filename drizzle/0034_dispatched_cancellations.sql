CREATE TABLE "order_cancellations" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"reason" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text NOT NULL,
	"actor_name" text NOT NULL,
	"status" text DEFAULT 'waiting-manager' NOT NULL,
	"stock_outcome" text,
	"refund_method" text,
	"refund_proof_file_id" text,
	"settled_by_id" text,
	"settled_by_name" text,
	"settled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_cancellations_status" CHECK ("order_cancellations"."status" in ('waiting-manager', 'settling', 'cancelled')),
	CONSTRAINT "order_cancellations_stock" CHECK ("order_cancellations"."stock_outcome" in ('restock','write-off'))
);
--> statement-breakpoint
ALTER TABLE "order_cancellations" ADD CONSTRAINT "order_cancellations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "order_cancellations_order" ON "order_cancellations" USING btree ("order_id");