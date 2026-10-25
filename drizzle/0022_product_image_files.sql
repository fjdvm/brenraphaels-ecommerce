ALTER TABLE "product_images" ALTER COLUMN "url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "product_images" ADD COLUMN "file_id" text;