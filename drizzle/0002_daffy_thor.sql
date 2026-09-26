CREATE TABLE "email_verification_resends" (
	"email" text PRIMARY KEY NOT NULL,
	"last_sent_at" timestamp with time zone NOT NULL
);
