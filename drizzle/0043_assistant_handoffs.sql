CREATE TABLE "assistant_handoffs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "assistant_handoffs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"chat_id" integer NOT NULL,
	"order_id" integer,
	"reason" text NOT NULL,
	"status" text NOT NULL,
	"summary" text,
	"sent_summary" text,
	"sent_source" text,
	"sent_to_model" text,
	"through_message_id" integer NOT NULL,
	"ticket_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "assistant_handoffs_status" CHECK ("assistant_handoffs"."status" in ('drafted','dropped','sent'))
);
--> statement-breakpoint
ALTER TABLE "assistant_handoffs" ADD CONSTRAINT "assistant_handoffs_chat_id_assistant_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."assistant_chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_handoffs" ADD CONSTRAINT "assistant_handoffs_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assistant_handoffs_chat" ON "assistant_handoffs" USING btree ("chat_id");