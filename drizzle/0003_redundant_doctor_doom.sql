CREATE TABLE "used_email_verification_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"verified_at" timestamp with time zone NOT NULL
);
