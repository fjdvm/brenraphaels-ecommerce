ALTER TABLE "order_returns" ADD COLUMN IF NOT EXISTS "refund_amount_in_centavos" integer;--> statement-breakpoint
ALTER TABLE "order_returns" ADD COLUMN IF NOT EXISTS "refund_paid_method" text;--> statement-breakpoint
ALTER TABLE "order_returns" ADD COLUMN IF NOT EXISTS "refund_paid_on" date;--> statement-breakpoint
ALTER TABLE "order_returns" ADD COLUMN IF NOT EXISTS "refund_reference" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_returns" ADD CONSTRAINT "order_returns_refund_amount" CHECK ("order_returns"."refund_amount_in_centavos" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_returns" ADD CONSTRAINT "order_returns_refund_paid_method" CHECK ("order_returns"."refund_paid_method" in ('gcash','maya','bank-transfer'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
