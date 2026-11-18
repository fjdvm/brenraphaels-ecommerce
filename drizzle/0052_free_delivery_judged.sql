ALTER TABLE "orders" ADD COLUMN "free_delivery" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "free_delivery_threshold_in_centavos" integer;