ALTER TABLE "order_returns" ADD COLUMN IF NOT EXISTS "refund_method" text;--> statement-breakpoint
ALTER TABLE "order_returns" ADD COLUMN IF NOT EXISTS "refund_account_name" text;--> statement-breakpoint
ALTER TABLE "order_returns" ADD COLUMN IF NOT EXISTS "refund_account_number" text;--> statement-breakpoint
ALTER TABLE "order_returns" ADD COLUMN IF NOT EXISTS "refund_bank_name" text;--> statement-breakpoint
ALTER TABLE "order_returns" ADD COLUMN IF NOT EXISTS "refund_destination_confirmed_at" timestamp with time zone;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_refund_destinations" (
	"customer_id" text PRIMARY KEY NOT NULL,
	"method" text NOT NULL,
	"account_name" text NOT NULL,
	"account_number" text NOT NULL,
	"bank_name" text,
	"confirmed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "customer_refund_destinations_method" CHECK ("customer_refund_destinations"."method" in ('gcash','maya','bank-transfer'))
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_refund_destinations" ADD CONSTRAINT "customer_refund_destinations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_returns" ADD CONSTRAINT "order_returns_refund_method" CHECK ("order_returns"."refund_method" in ('gcash','maya','bank-transfer'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
