ALTER TABLE "tickets" ADD COLUMN "hold_reason" text;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "hold_note" text;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "hold_until" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "tickets_on_hold_until" ON "tickets" USING btree ("hold_until") WHERE "status" = 'on_hold';
