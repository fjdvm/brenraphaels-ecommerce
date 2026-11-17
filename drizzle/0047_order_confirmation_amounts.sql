-- The final amounts saved when Staff confirm an Order; existing Orders keep them empty and are left untouched.
ALTER TABLE "orders" ADD COLUMN "approved_discount_in_centavos" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "total_in_centavos" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "confirmed_at" timestamp with time zone;
