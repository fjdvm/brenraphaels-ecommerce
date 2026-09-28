CREATE TABLE "applications" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "applications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"applicant_id" text NOT NULL,
	"job_posting_id" text NOT NULL,
	"reference_number" text NOT NULL,
	"status" text NOT NULL,
	"profile_snapshot" jsonb NOT NULL,
	"documents_snapshot" jsonb NOT NULL,
	"consented_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "applications_reference_number_unique" UNIQUE("reference_number")
);
--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_applicant_id_applicant_profiles_applicant_id_fk" FOREIGN KEY ("applicant_id") REFERENCES "public"."applicant_profiles"("applicant_id") ON DELETE cascade ON UPDATE no action;