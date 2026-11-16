ALTER TABLE "tickets" ADD COLUMN "follow_up_of_id" integer;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "rating" integer;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "rating_comment" text;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "rated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_follow_up_of_id_tickets_id_fk" FOREIGN KEY ("follow_up_of_id") REFERENCES "public"."tickets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_rating_range" CHECK ("rating" IS NULL OR "rating" BETWEEN 1 AND 5);--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_rating_comment_length" CHECK ("rating_comment" IS NULL OR char_length("rating_comment") <= 500);--> statement-breakpoint
CREATE INDEX "tickets_follow_up_of_id_idx" ON "tickets" USING btree ("follow_up_of_id");
