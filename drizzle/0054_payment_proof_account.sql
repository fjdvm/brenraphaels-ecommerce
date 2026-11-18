ALTER TABLE "order_payment_proofs" ADD COLUMN "account_id" text;--> statement-breakpoint
ALTER TABLE "order_payment_proofs" ADD COLUMN "account_method" text;--> statement-breakpoint
ALTER TABLE "order_payment_proofs" ADD COLUMN "account_bank_name" text;--> statement-breakpoint
ALTER TABLE "order_payment_proofs" ADD COLUMN "account_label" text;--> statement-breakpoint
ALTER TABLE "order_payment_proofs" ADD COLUMN "account_name" text;--> statement-breakpoint
ALTER TABLE "order_payment_proofs" ADD COLUMN "account_number" text;--> statement-breakpoint
ALTER TABLE "order_payment_proofs" ADD COLUMN "submission_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "order_payment_proofs_submission_key" ON "order_payment_proofs" USING btree ("order_id","submission_key");
