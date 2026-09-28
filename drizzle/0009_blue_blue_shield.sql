CREATE TABLE "order_delivery_addresses" (
	"order_id" integer PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"street" text NOT NULL,
	"barangay" text NOT NULL,
	"city" text NOT NULL,
	"province" text NOT NULL,
	"postal_code" text NOT NULL,
	"country" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_delivery_addresses" ADD CONSTRAINT "order_delivery_addresses_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;