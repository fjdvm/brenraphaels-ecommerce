CREATE TABLE "applicant_profiles" ("applicant_id" text PRIMARY KEY NOT NULL, "full_name" text NOT NULL, "email" text NOT NULL UNIQUE, "phone" text, "location" text, "summary" text, "skills" text DEFAULT '' NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL);
--> statement-breakpoint
CREATE TABLE "applicant_education" ("id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY, "applicant_id" text NOT NULL, "school" text NOT NULL, "qualification" text NOT NULL, "field_of_study" text, "started_on" text, "completed_on" text);
--> statement-breakpoint
CREATE TABLE "applicant_work_history" ("id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY, "applicant_id" text NOT NULL, "employer" text NOT NULL, "title" text NOT NULL, "started_on" text, "ended_on" text, "description" text);
--> statement-breakpoint
CREATE TABLE "applicant_documents" ("id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY, "applicant_id" text NOT NULL, "name" text NOT NULL, "content_type" text NOT NULL, "size" integer NOT NULL, "blob_pathname" text NOT NULL UNIQUE, "created_at" timestamp with time zone DEFAULT now() NOT NULL);
--> statement-breakpoint
ALTER TABLE "applicant_education" ADD CONSTRAINT "applicant_education_applicant_id_applicant_profiles_applicant_id_fk" FOREIGN KEY ("applicant_id") REFERENCES "applicant_profiles"("applicant_id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "applicant_work_history" ADD CONSTRAINT "applicant_work_history_applicant_id_applicant_profiles_applicant_id_fk" FOREIGN KEY ("applicant_id") REFERENCES "applicant_profiles"("applicant_id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "applicant_documents" ADD CONSTRAINT "applicant_documents_applicant_id_applicant_profiles_applicant_id_fk" FOREIGN KEY ("applicant_id") REFERENCES "applicant_profiles"("applicant_id") ON DELETE cascade;
