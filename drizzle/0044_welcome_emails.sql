CREATE TABLE "welcome_emails" (
	"customer_id" text PRIMARY KEY NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL
);
