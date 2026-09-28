CREATE TABLE "feedback_rate_limits" (
	"ip_address" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"submission_count" integer NOT NULL
);
