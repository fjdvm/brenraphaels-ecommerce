ALTER TABLE "order_email_outcomes" ADD COLUMN IF NOT EXISTS "occurrence" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_email_outcomes" ADD COLUMN IF NOT EXISTS "message_id" text;--> statement-breakpoint
ALTER TABLE "order_email_outcomes" DROP CONSTRAINT IF EXISTS "order_email_outcomes_order_id_kind_pk";--> statement-breakpoint
ALTER TABLE "order_email_outcomes" ADD CONSTRAINT "order_email_outcomes_order_id_kind_occurrence_pk" PRIMARY KEY("order_id","kind","occurrence");
