CREATE TABLE "feedback_analysis_runs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "feedback_analysis_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"started_by_kind" text NOT NULL,
	"started_by_id" text,
	"started_by_name" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"analyzed" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"model" text
);
--> statement-breakpoint
ALTER TABLE "order_feedback" ADD COLUMN "sentiment" text;--> statement-breakpoint
ALTER TABLE "order_feedback" ADD COLUMN "sentiment_model" text;--> statement-breakpoint
ALTER TABLE "order_feedback" ADD COLUMN "sentiment_analyzed_at" timestamp with time zone;