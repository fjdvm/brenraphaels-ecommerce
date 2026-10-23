CREATE TABLE "order_return_history" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "order_return_history_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"return_id" integer NOT NULL,
	"status" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text NOT NULL,
	"actor_name" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"note" text,
	CONSTRAINT "order_return_history_actor_type" CHECK ("order_return_history"."actor_type" in ('customer','staff'))
);
--> statement-breakpoint
CREATE TABLE "order_return_images" (
	"return_id" integer NOT NULL,
	"position" integer NOT NULL,
	"file_id" text NOT NULL,
	CONSTRAINT "order_return_images_return_id_position_pk" PRIMARY KEY("return_id","position"),
	CONSTRAINT "order_return_images_position" CHECK ("order_return_images"."position" between 1 and 3)
);
--> statement-breakpoint
CREATE TABLE "order_return_items" (
	"return_id" integer NOT NULL,
	"order_line_id" integer NOT NULL,
	"product_name" text NOT NULL,
	"size_label" text NOT NULL,
	"quantity" integer NOT NULL,
	"price_in_centavos" integer NOT NULL,
	CONSTRAINT "order_return_items_return_id_order_line_id_pk" PRIMARY KEY("return_id","order_line_id"),
	CONSTRAINT "order_return_items_quantity" CHECK ("order_return_items"."quantity" > 0),
	CONSTRAINT "order_return_items_price" CHECK ("order_return_items"."price_in_centavos" >= 0)
);
--> statement-breakpoint
CREATE TABLE "order_returns" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "order_returns_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"order_id" integer NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"reason" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"amount_in_centavos" integer NOT NULL,
	"goods_required" boolean,
	"decline_reason" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"refunded_at" timestamp with time zone,
	CONSTRAINT "order_returns_status" CHECK ("order_returns"."status" in ('requested','approved','goods received','refunded','declined','cancelled')),
	CONSTRAINT "order_returns_reason" CHECK ("order_returns"."reason" in ('damaged','defective','wrong item','other')),
	CONSTRAINT "order_returns_amount" CHECK ("order_returns"."amount_in_centavos" >= 0)
);
--> statement-breakpoint
ALTER TABLE "order_return_history" ADD CONSTRAINT "order_return_history_return_id_order_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."order_returns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_return_images" ADD CONSTRAINT "order_return_images_return_id_order_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."order_returns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_return_items" ADD CONSTRAINT "order_return_items_return_id_order_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."order_returns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_return_items" ADD CONSTRAINT "order_return_items_order_line_id_order_lines_id_fk" FOREIGN KEY ("order_line_id") REFERENCES "public"."order_lines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_returns" ADD CONSTRAINT "order_returns_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_returns_order_id" ON "order_returns" USING btree ("order_id");