ALTER TABLE "orders" ADD COLUMN "gcash_reference_number" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_proof_screenshot_pathname" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_proof_submitted_at" timestamp with time zone;