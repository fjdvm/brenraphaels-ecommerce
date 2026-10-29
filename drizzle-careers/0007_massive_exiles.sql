ALTER TABLE "applicant_documents" DROP CONSTRAINT "applicant_documents_blob_pathname_unique";--> statement-breakpoint
ALTER TABLE "applicant_documents" ADD COLUMN "file_id" text;--> statement-breakpoint
ALTER TABLE "applicant_documents" ADD COLUMN "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "applicant_documents" DROP COLUMN "blob_pathname";--> statement-breakpoint
ALTER TABLE "applicant_documents" ADD CONSTRAINT "applicant_documents_file_id_unique" UNIQUE("file_id");