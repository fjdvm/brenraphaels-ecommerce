ALTER TABLE "order_returns" ADD COLUMN IF NOT EXISTS "refund_delivery_fee_in_centavos" integer;--> statement-breakpoint
ALTER TABLE "order_returns" ADD COLUMN IF NOT EXISTS "refund_delivery_fee_reason" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_returns" ADD CONSTRAINT "order_returns_refund_delivery_fee" CHECK ("order_returns"."refund_delivery_fee_in_centavos" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
