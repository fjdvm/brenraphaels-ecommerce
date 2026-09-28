CREATE TABLE "feedback_rate_limits" (
	"ip_address" text PRIMARY KEY NOT NULL,
	"submission_times" timestamp with time zone[] NOT NULL
);
