CREATE TABLE "ims_price_changes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ims_price_changes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"size_id" integer NOT NULL,
	"old_price_in_centavos" integer NOT NULL,
	"new_price_in_centavos" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "ims_price_changes_status" CHECK ("ims_price_changes"."status" in ('pending', 'approved'))
);
--> statement-breakpoint
ALTER TABLE "sizes" ADD COLUMN "ims_product_id" integer;--> statement-breakpoint
ALTER TABLE "sizes" ADD COLUMN "discontinued" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ims_price_changes" ADD CONSTRAINT "ims_price_changes_size_id_sizes_id_fk" FOREIGN KEY ("size_id") REFERENCES "public"."sizes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ims_price_changes_one_pending" ON "ims_price_changes" USING btree ("size_id") WHERE "ims_price_changes"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "sizes_ims_product_id" ON "sizes" USING btree ("ims_product_id");