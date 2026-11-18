ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cod_collected_amount_in_centavos" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cod_collected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cod_collected_by_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cod_collected_by_name" text;