CREATE TABLE "order_email_outcomes" (
	"order_id" integer NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_email_outcomes_order_id_kind_pk" PRIMARY KEY("order_id","kind")
);
--> statement-breakpoint
ALTER TABLE "order_email_outcomes" ADD CONSTRAINT "order_email_outcomes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;