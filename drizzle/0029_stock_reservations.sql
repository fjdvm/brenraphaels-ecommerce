CREATE TABLE "stock_outbox" (
	"key" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"order_id" integer,
	"payload" jsonb NOT NULL,
	"accepted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "stock_reservations" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"customer_name" text NOT NULL,
	"order_id" integer,
	"state" text NOT NULL,
	"lines" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_reservations_work" ON "stock_reservations" USING btree ("state","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_reservations_order" ON "stock_reservations" USING btree ("order_id");
--> statement-breakpoint
ALTER TABLE "stock_outbox" ADD CONSTRAINT "stock_outbox_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");
