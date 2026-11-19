-- 0049_address_region carried a journal timestamp older than 0048's, so Drizzle skipped it on databases already past it
-- (production). Re-apply it idempotently; where 0049 did run, this is a no-op.
ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "region" text;--> statement-breakpoint
ALTER TABLE "order_delivery_addresses" ADD COLUMN IF NOT EXISTS "region" text;
