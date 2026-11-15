CREATE TABLE "order_payment_proofs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "order_payment_proofs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"order_id" integer NOT NULL,
	"reference" text,
	"screenshot_file_id" text,
	"screenshot_pathname" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rejected_at" timestamp with time zone,
	"rejected_by_id" text,
	"rejected_by_name" text,
	"rejection_reason" text
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_proof_rejected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_proof_rejections" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "order_payment_proofs" ADD CONSTRAINT "order_payment_proofs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_payment_proofs_order" ON "order_payment_proofs" USING btree ("order_id");--> statement-breakpoint
INSERT INTO "order_payment_proofs" ("order_id", "reference", "screenshot_file_id", "screenshot_pathname", "submitted_at")
SELECT "id", "gcash_reference_number", "payment_proof_file_id", "payment_proof_screenshot_pathname", "payment_proof_submitted_at"
FROM "orders" WHERE "payment_proof_submitted_at" IS NOT NULL;
